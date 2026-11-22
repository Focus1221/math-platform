'use client';
import TopicEditorModal from './TopicEditorModal';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import TheoryTab from './TheoryTab';
import InteractiveTab from './InteractiveTab';
import HomeworkTab from './HomeworkTab';
import AiTutorTab from './AiTutorTab';
import type { Course, Material, Profile, Topic } from '@/types/db';

interface Props {
  course: Course;
  initialTopics: Topic[];
  initialCompletedIds: string[];
  profile: Profile | null;
}

type TabId = 'theory' | 'interactive' | 'homework' | 'ai' | 'passport';

export default function CourseWorkspace({
  course,
  initialTopics,
  initialCompletedIds,
  profile,
}: Props) {
  const supabase = createClient();
  const isTeacher = profile?.role === 'teacher';

  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [teacherMode, setTeacherMode] = useState(false);
  const [activeQuarter, setActiveQuarter] = useState<number>(
    initialTopics[0]?.quarter || 1
  );
  const [activeTopicId, setActiveTopicId] = useState<string>(
    initialTopics[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<TabId>('theory');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'assessment' | 'completed'>('all');
  const [completedIds, setCompletedIds] = useState<string[]>(initialCompletedIds);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [editingTopicModal, setEditingTopicModal] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [notesDraft, setNotesDraft] = useState('');
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicSection, setNewTopicSection] = useState('');

  const activeTopic = useMemo(
    () => topics.find((t) => t.id === activeTopicId) || topics[0] || null,
    [topics, activeTopicId]
  );

  // Загружаем материалы при смене темы
  useEffect(() => {
    if (!activeTopic) return;
    setNotesDraft(activeTopic.teacher_notes || '');
    let cancelled = false;
    supabase
      .from('materials')
      .select('*')
      .eq('topic_id', activeTopic.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) setMaterials(data as Material[]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTopic?.id]);

  // Фильтрация тем для сайдбара
  const groupedTopics = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = topics.filter((t) => {
      if (!q && t.quarter !== activeQuarter) return false;
      if (filter === 'assessment' && !t.is_assessment) return false;
      if (filter === 'completed' && !completedIds.includes(t.id)) return false;
      if (q) {
        const objs = Array.isArray(t.objectives) ? t.objectives.join(' ') : '';
        const hay = `${t.title} ${t.section} ${objs}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
    const map = new Map<string, Topic[]>();
    list.forEach((t) => {
      if (!map.has(t.section)) map.set(t.section, []);
      map.get(t.section)!.push(t);
    });
    return map;
  }, [topics, activeQuarter, search, filter, completedIds]);

  const progressPercent = topics.length
    ? Math.round((completedIds.length / topics.length) * 100)
    : 0;

  async function toggleComplete(topicId: string) {
    if (!profile) {
      alert('Войди в аккаунт, чтобы сохранять прогресс.');
      return;
    }
    const nextDone = !completedIds.includes(topicId);
    setCompletedIds((prev) =>
      nextDone ? [...prev, topicId] : prev.filter((id) => id !== topicId)
    );
    await supabase.from('topic_progress').upsert({
      student_id: profile.id,
      topic_id: topicId,
      completed: nextDone,
      updated_at: new Date().toISOString(),
    });
  }

  async function handleAddTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!newTopicTitle.trim()) return;
    const nextOrder = topics.length
      ? Math.max(...topics.map((t) => t.order_index)) + 1
      : 1;
    const { data, error } = await supabase
      .from('topics')
      .insert({
        course_id: course.id,
        order_index: nextOrder,
        quarter: activeQuarter,
        section: newTopicSection.trim() || `Раздел ${activeQuarter} четверти`,
        title: newTopicTitle.trim(),
        theory_md: `### ${newTopicTitle.trim()}\nДобавьте конспект урока в режиме учителя.`,
      })
      .select()
      .single();

    if (!error && data) {
      const created = data as Topic;
      setTopics((prev) => [...prev, created]);
      setActiveTopicId(created.id);
      setNewTopicTitle('');
    }
  }

  async function saveTeacherNotes() {
    if (!activeTopic) return;
    const { data } = await supabase
      .from('topics')
      .update({ teacher_notes: notesDraft })
      .eq('id', activeTopic.id)
      .select()
      .single();
    if (data) {
      setTopics((prev) =>
        prev.map((t) => (t.id === activeTopic.id ? (data as Topic) : t))
      );
      alert('Заметки сохранены!');
    }
  }

  const activeObjectives = Array.isArray(activeTopic?.objectives)
    ? activeTopic.objectives
    : [];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Шапка */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 shrink-0"
            >
              ☰
            </button>
            <Link
              href="/courses"
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-extrabold text-base shrink-0"
              title="Все курсы"
            >
              ∑{course.grade_number}
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {course.title}
              </h1>
              <p className="text-[11px] text-slate-500 truncate">
                <Link href="/courses" className="text-indigo-600 hover:underline">
                  ← Все классы
                </Link>{' '}
                · {course.academic_year} · {course.total_hours} ч
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isTeacher && (
              <>
                <Link
                  href="/teacher/submissions"
                  className="px-2.5 sm:px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold whitespace-nowrap transition"
                >
                  📥 Проверка ДЗ
                </Link>
                <Link
                href="/teacher/journal"
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold transition"
                >
                📊 Журнал
                </Link>
                <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTeacherMode(false)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                      !teacherMode
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    🎓 Ученик
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherMode(true)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                      teacherMode
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    🛠️ Редактор
                  </button>
                </div>
              </>
            )}

            {!profile && (
              <Link
                href="/login"
                className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold whitespace-nowrap"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-[1600px] w-full mx-auto relative">
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden"
          />
        )}

        {/* Сайдбар КТП */}
        <aside
          className={`fixed lg:sticky top-16 left-0 z-30 h-[calc(100vh-4rem)] w-[300px] sm:w-[320px] bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 shrink-0 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-600">Прогресс курса</span>
                <span className="text-emerald-600 font-bold">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-500">
                Пройдено {completedIds.length} из {topics.length} тем
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setActiveQuarter(q)}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    activeQuarter === q
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {q} ч.
                </button>
              ))}
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск темы или кода ЦО..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />

            <div className="flex gap-1.5">
              {(
                [
                  ['all', 'Все'],
                  ['assessment', 'СОР / СОЧ'],
                  ['completed', 'Пройденные'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition ${
                    filter === id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {Array.from(groupedTopics.entries()).map(([section, secTopics]) => (
              <details key={section} open className="group">
                <summary className="cursor-pointer list-none px-2.5 py-2 rounded-xl bg-slate-50 text-xs font-bold text-slate-800 flex justify-between">
                  <span className="truncate">{section}</span>
                  <span className="text-[10px] text-slate-500 ml-2">
                    {secTopics.length}
                  </span>
                </summary>
                <div className="mt-1.5 space-y-1 pl-1">
                  {secTopics.map((t) => {
                    const isActive = t.id === activeTopic?.id;
                    const isDone = completedIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setActiveTopicId(t.id);
                          setMobileOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition flex items-start gap-2 ${
                          isActive
                            ? 'bg-indigo-50 border-indigo-400'
                            : 'bg-white border-transparent hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                            isDone
                              ? 'bg-emerald-500 text-white'
                              : isActive
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isDone ? '✓' : t.order_index}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-800 leading-snug">
                            {t.title}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {t.dates} · {t.hours} ч{' '}
                            {t.is_assessment ? '· СОР/СОЧ' : ''}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </details>
            ))}

            {teacherMode && (
              <form
                onSubmit={handleAddTopic}
                className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-2"
              >
                <div className="text-[11px] font-bold text-indigo-800">
                  + Новая тема ({activeQuarter} ч.)
                </div>
                <input
                  type="text"
                  value={newTopicSection}
                  onChange={(e) => setNewTopicSection(e.target.value)}
                  placeholder="Раздел (напр. 6.1А Отношения)"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg"
                />
                <input
                  type="text"
                  required
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  placeholder="Название темы урока"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg"
                />
                <button
                  type="submit"
                  className="w-full py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                >
                  Добавить тему
                </button>
              </form>
            )}
          </div>
        </aside>

        {/* Основной контент */}
        <main className="flex-1 min-w-0 p-3 sm:p-6 lg:p-8">
          {!activeTopic ? (
            <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-2">
              <div className="text-3xl">📚</div>
              <h2 className="text-lg font-bold">В этом курсе пока нет тем</h2>
              <p className="text-sm text-slate-500">
                Включи «Редактор» в правом верхнем углу, чтобы добавить первую тему в сайдбаре.
              </p>
            </div>
          ) : (
           <div className="max-w-5xl mx-auto space-y-5">
              {/* Заголовок темы */}
              <section className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 font-semibold text-slate-700">
                        {activeTopic.quarter} четверть
                      </span>
                      <span className="font-semibold text-indigo-600">
                        {activeTopic.section}
                      </span>
                      {activeTopic.dates && (
                        <span className="text-slate-500">
                          📅 {activeTopic.dates} ({activeTopic.hours} ч.)
                        </span>
                      )}
                      {activeTopic.is_assessment && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                          СОР / СОЧ
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                      {activeTopic.order_index}. {activeTopic.title}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {teacherMode && (
                      <button
                        type="button"
                        onClick={() => setEditingTopicModal(true)}
                        className="px-3.5 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs sm:text-sm font-bold transition"
                      >
                        ⚙️ Настроить тему
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleComplete(activeTopic.id)}
                      className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition ${
                        completedIds.includes(activeTopic.id)
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-900 hover:bg-indigo-600 text-white'
                      }`}
                    >
                      {completedIds.includes(activeTopic.id)
                        ? '✓ Тема пройдена'
                        : '○ Отметить пройденной'}
                    </button>
                  </div>
                </div>

                {activeTopic.value_example && (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs sm:text-sm text-indigo-900">
                    <strong>Контекст урока:</strong> {activeTopic.value_example}
                  </div>
                )}
              </section>

              {/* Вкладки */}
              <nav className="bg-white p-1.5 rounded-2xl border border-slate-200 overflow-x-auto">
                <div className="flex gap-1 min-w-max">
                  {(
                    [
                      ['theory', '📘 Теория и материалы'],
                      ['interactive', '🎮 Интерактив и игры'],
                      ['homework', '📝 Домашнее задание'],
                      ['ai', '🤖 ИИ-Тьютор'],
                      ['passport', '📋 Паспорт КТП'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveTab(id)}
                      className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                        activeTab === id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </nav>

              {/* Содержимое вкладок */}
              {activeTab === 'theory' && (
                <TheoryTab
                  topic={activeTopic}
                  materials={materials}
                  canEdit={teacherMode}
                  onTopicUpdated={(upd) =>
                    setTopics((prev) =>
                      prev.map((t) => (t.id === upd.id ? upd : t))
                    )
                  }
                  onMaterialsChanged={setMaterials}
                />
              )}

              {activeTab === 'interactive' && (
                <InteractiveTab
                  topic={activeTopic}
                  materials={materials}
                  canEdit={teacherMode}
                  profile={profile}
                  isTopicCompleted={completedIds.includes(activeTopic.id)}
                  onMaterialsChanged={setMaterials}
                />
              )}

              {activeTab === 'homework' && (
                <HomeworkTab
                  topic={activeTopic}
                  canEdit={teacherMode}
                  profile={profile}
                />
              )}

              {activeTab === 'ai' && (
                <AiTutorTab
                  topic={activeTopic}
                  profile={profile}
                  onGoToTheory={() => setActiveTab('theory')}
                />
              )}

              {activeTab === 'passport' && (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Цели обучения (ЦО)
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {activeObjectives.map((o, i) => (
                        <li
                          key={i}
                          className="text-xs sm:text-sm text-slate-700 p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                        >
                          🎯 {o}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase text-slate-500">
                      Методические заметки учителя
                    </h4>
                    {teacherMode ? (
                      <>
                        <textarea
                          rows={4}
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl"
                        />
                        <button
                          type="button"
                          onClick={saveTeacherNotes}
                          className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                        >
                          💾 Сохранить заметки
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">
                        {activeTopic.teacher_notes || 'Заметки не добавлены.'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      {editingTopicModal && activeTopic && (
        <TopicEditorModal
          topic={activeTopic}
          onClose={() => setEditingTopicModal(false)}
          onUpdated={(upd) => {
            setTopics((prev) =>
              prev
                .map((t) => (t.id === upd.id ? upd : t))
                .sort((a, b) => a.order_index - b.order_index)
            );
            setActiveQuarter(upd.quarter);
          }}
          onDeleted={(deletedId) => {
            setTopics((prev) => {
              const rest = prev.filter((t) => t.id !== deletedId);
              setActiveTopicId(rest[0]?.id || '');
              return rest;
            });
          }}
        />
      )}
    </div>
  );
}