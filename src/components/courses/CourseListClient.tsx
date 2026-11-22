'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AppNav from '@/components/layout/AppNav';
import { cleanSectionName } from '@/lib/format/cleanTopic';
import { playSound } from '@/lib/audio/sound';
import type { Course, Profile } from '@/types/db';

export interface MapTopicItem {
  id: string;
  course_id: string;
  order_index: number;
  quarter: number;
  section: string;
  title: string;
  value_example: string;
  is_assessment: boolean;
  sim_type: string;
  completed: boolean;
  simSolved: number;
  hwTotal: number;
  hwDone: number;
  scheduleBadge: 'today' | 'tomorrow' | null;
}

interface Props {
  initialCourses: Course[];
  initialTopics?: MapTopicItem[];
  profile: Profile | null;
}

const CHAPTER_THEMES = [
  {
    icon: '🔢',
    gradient: 'from-indigo-500 via-violet-500 to-purple-600',
    softBg: 'bg-indigo-50/70 border-indigo-200',
    pill: 'bg-indigo-100 text-indigo-800',
    bar: 'bg-indigo-500',
  },
  {
    icon: '🍕',
    gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
    softBg: 'bg-emerald-50/70 border-emerald-200',
    pill: 'bg-emerald-100 text-emerald-800',
    bar: 'bg-emerald-500',
  },
  {
    icon: '📐',
    gradient: 'from-amber-500 via-orange-500 to-rose-500',
    softBg: 'bg-amber-50/70 border-amber-200',
    pill: 'bg-amber-100 text-amber-800',
    bar: 'bg-amber-500',
  },
  {
    icon: '🚀',
    gradient: 'from-sky-500 via-blue-500 to-indigo-600',
    softBg: 'bg-sky-50/70 border-sky-200',
    pill: 'bg-sky-100 text-sky-800',
    bar: 'bg-sky-500',
  },
  {
    icon: '💯',
    gradient: 'from-fuchsia-500 via-pink-500 to-rose-600',
    softBg: 'bg-rose-50/70 border-rose-200',
    pill: 'bg-rose-100 text-rose-800',
    bar: 'bg-rose-500',
  },
];

function getTopicStars(t: MapTopicItem): {
  theoryStar: boolean;
  simStar: boolean;
  hwStar: boolean;
  earned: number;
  possible: number;
} {
  const theoryStar = t.completed;
  const simStar = t.simSolved >= 3;
  const hasHw = t.hwTotal > 0;
  const hwStar = hasHw && t.hwDone >= t.hwTotal;
  const possible = hasHw ? 3 : 2;
  const earned = (theoryStar ? 1 : 0) + (simStar ? 1 : 0) + (hwStar ? 1 : 0);
  return { theoryStar, simStar, hwStar, earned, possible };
}

export default function CourseListClient({
  initialCourses,
  initialTopics = [],
  profile,
}: Props) {
  const supabase = createClient();
  const isTeacher = profile?.role === 'teacher';

  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    initialCourses[0]?.id || ''
  );

  // Автоматически выбираем четверть, в которой есть урок «Сегодня», иначе 1-ю
  const [activeQuarter, setActiveQuarter] = useState<number>(() => {
    const todayItem = initialTopics.find(
      (t) => t.course_id === initialCourses[0]?.id && t.scheduleBadge === 'today'
    );
    return todayItem?.quarter || 1;
  });

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'hw' | 'assessment' | 'done'>(
    'all'
  );

  // Создание нового курса (только учитель)
  const [showCreate, setShowCreate] = useState(false);
  const [grade, setGrade] = useState(6);
  const [subject, setSubject] = useState('Математика');
  const [hours, setHours] = useState(170);
  const [saving, setSaving] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) || courses[0] || null,
    [courses, selectedCourseId]
  );

  const courseTopics = useMemo(
    () =>
      initialTopics
        .filter((t) => t.course_id === selectedCourse?.id)
        .sort((a, b) => a.order_index - b.order_index),
    [initialTopics, selectedCourse?.id]
  );

  // Общая статистика курса
  const courseStats = useMemo(() => {
    let completedCount = 0;
    let earnedStars = 0;
    let totalStars = 0;
    for (const t of courseTopics) {
      if (t.completed) completedCount++;
      const st = getTopicStars(t);
      earnedStars += st.earned;
      totalStars += st.possible;
    }
    const percent = courseTopics.length
      ? Math.round((completedCount / courseTopics.length) * 100)
      : 0;
    return {
      totalTopics: courseTopics.length,
      completedCount,
      earnedStars,
      totalStars,
      percent,
    };
  }, [courseTopics]);

  // Отфильтрованные главы (разделы)
  const chapters = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = courseTopics.filter((t) => {
      if (!q && activeQuarter !== 0 && t.quarter !== activeQuarter) return false;
      if (filter === 'hw' && t.hwTotal === 0) return false;
      if (filter === 'assessment' && !t.is_assessment) return false;
      if (filter === 'done' && !t.completed) return false;
      if (q) {
        const hay = `${t.title} ${cleanSectionName(t.section)} ${t.value_example}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });

    const map = new Map<string, MapTopicItem[]>();
    for (const t of filtered) {
      const sec = cleanSectionName(t.section);
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(t);
    }

    return Array.from(map.entries()).map(([name, items], idx) => {
      const done = items.filter((i) => i.completed).length;
      const pct = items.length ? Math.round((done / items.length) * 100) : 0;
      return {
        name,
        items,
        done,
        pct,
        theme: CHAPTER_THEMES[idx % CHAPTER_THEMES.length],
      };
    });
  }, [courseTopics, activeQuarter, search, filter]);

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const slugBase = subject.toLowerCase().includes('алг')
      ? 'algebra'
      : subject.toLowerCase().includes('геом')
        ? 'geometry'
        : 'math';
    const slug = `${slugBase}-${grade}-${Date.now().toString().slice(-3)}`;

    const { data, error } = await supabase
      .from('courses')
      .insert({
        slug,
        grade_number: grade,
        subject,
        title: `${subject} ${grade} класс`,
        academic_year: '2026-2027',
        total_hours: hours,
        is_published: true,
      })
      .select()
      .single();

    if (!error && data) {
      const created = data as Course;
      setCourses((prev) =>
        [...prev, created].sort((a, b) => a.grade_number - b.grade_number)
      );
      setSelectedCourseId(created.id);
      setShowCreate(false);
    } else if (error) {
      alert('Ошибка создания курса: ' + error.message);
    }
    setSaving(false);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav profile={profile} />

      <main className="max-w-6xl w-full mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-6">
        {/* Верхняя панель выбора класса и кнопка учителя */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {courses.map((c) => {
              const active = c.id === selectedCourse?.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    playSound('click');
                    setSelectedCourseId(c.id);
                  }}
                  className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold border-2 transition flex items-center gap-2 ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-50 text-indigo-700'
                    }`}
                  >
                    {c.grade_number}
                  </span>
                  <span>{c.title}</span>
                </button>
              );
            })}
          </div>

          {isTeacher && (
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="btn-tactile px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 text-white text-xs font-extrabold shadow-xs"
            >
              {showCreate ? '✕ Закрыть' : '+ Добавить класс'}
            </button>
          )}
        </div>

        {/* Форма создания курса (учитель) */}
        {isTeacher && showCreate && (
          <form
            onSubmit={handleCreateCourse}
            className="bg-white rounded-3xl border-2 border-indigo-200 p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end animate-pop"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Класс
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
              >
                {[5, 6, 7, 8, 9, 10, 11].map((g) => (
                  <option key={g} value={g}>
                    {g} класс
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Предмет
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="Математика">Математика</option>
                <option value="Алгебра">Алгебра</option>
                <option value="Геометрия">Геометрия</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Часов в год
              </label>
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="btn-tactile py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 text-white text-sm font-extrabold"
            >
              {saving ? 'Создаём...' : 'Создать курс'}
            </button>
          </form>
        )}

        {/* Красочный баннер-карта выбранного курса */}
        {selectedCourse && (
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white p-6 sm:p-7 shadow-md">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-extrabold">
                  <span>🗺️ Карта знаний</span>
                  <span>·</span>
                  <span>{courseStats.totalTopics} уроков</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {selectedCourse.title}
                </h1>
                <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed">
                  Выбирай любую главу: открывай наглядный урок, зажигай звёзды в
                  тренажёрах и выполняй домашние задания в своём темпе.
                </p>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
                <div className="px-4 py-3 rounded-2xl bg-white/15 backdrop-blur-xs border border-white/20 text-center min-w-[115px]">
                  <div className="text-xl sm:text-2xl font-extrabold tabular-nums leading-none">
                    ⭐ {courseStats.earnedStars}
                  </div>
                  <div className="text-[11px] font-semibold text-indigo-100 mt-1">
                    из {courseStats.totalStars} звёзд
                  </div>
                </div>

                <div className="px-4 py-3 rounded-2xl bg-white/15 backdrop-blur-xs border border-white/20 text-center min-w-[115px]">
                  <div className="text-xl sm:text-2xl font-extrabold tabular-nums leading-none">
                    {courseStats.percent}%
                  </div>
                  <div className="text-[11px] font-semibold text-indigo-100 mt-1">
                    пройдено ({courseStats.completedCount}/{courseStats.totalTopics})
                  </div>
                </div>
              </div>
            </div>

            {/* Прогресс-бар курса */}
            <div className="relative z-10 mt-5 h-2.5 w-full rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 via-emerald-300 to-teal-200 transition-all duration-500"
                style={{ width: `${Math.max(courseStats.percent, 2)}%` }}
              />
            </div>
          </section>
        )}

        {/* Панель четвертей, поиска и фильтров */}
        {selectedCourse && (
          <section className="bg-white rounded-3xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Четверти */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[1, 2, 3, 4, 0].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      playSound('click');
                      setActiveQuarter(q);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                      activeQuarter === q
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {q === 0 ? 'Все четверти' : `${q} четверть`}
                  </button>
                ))}
              </div>

              {/* Поиск */}
              <div className="relative flex-1 md:max-w-xs">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  🔍
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Найти тему или слово..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Быстрые фильтры */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
              {(
                [
                  ['all', '✨ Все уроки'],
                  ['hw', '📝 Есть ДЗ'],
                  ['assessment', '🏆 СОР / СОЧ'],
                  ['done', '✓ Пройденные'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
                    filter === id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Главы-острова и плитки уроков */}
        {!selectedCourse ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center text-sm text-slate-500">
            Курсы ещё не добавлены.
          </div>
        ) : courseTopics.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3">
            <div className="text-4xl">🗺️</div>
            <h2 className="text-lg font-extrabold text-slate-900">
              В курсе «{selectedCourse.title}» пока нет уроков
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Открой страницу курса в режиме редактора, чтобы наполнить его темами.
            </p>
            <Link
              href={`/courses/${selectedCourse.slug}`}
              className="inline-block btn-tactile px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 text-white text-xs sm:text-sm font-extrabold"
            >
              Перейти в редактор курса →
            </Link>
          </div>
        ) : chapters.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-2">
            <div className="text-3xl">🔎</div>
            <p className="text-sm font-extrabold text-slate-800">
              По этому фильтру уроков не найдено
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilter('all');
                setActiveQuarter(0);
              }}
              className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold"
            >
              Показать все уроки курса
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {chapters.map((chapter, chapterIdx) => (
              <section
                key={`${chapter.name}-${chapterIdx}`}
                className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden"
              >
                {/* Цветная шапка главы */}
                <div
                  className={`bg-gradient-to-r ${chapter.theme.gradient} text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-2xl shrink-0">
                      {chapter.theme.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                        Глава {chapterIdx + 1} · {chapter.items.length} уроков
                      </div>
                      <h2 className="text-base sm:text-lg font-extrabold leading-tight truncate">
                        {chapter.name}
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="w-24 sm:w-32 h-2 rounded-full bg-white/25 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white transition-all"
                        style={{ width: `${chapter.pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-extrabold tabular-nums bg-white/20 px-2.5 py-1 rounded-xl">
                      {chapter.done}/{chapter.items.length}
                    </span>
                  </div>
                </div>

                {/* Плитки уроков внутри главы */}
                <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {chapter.items.map((topic) => {
                    const stars = getTopicStars(topic);
                    const isToday = topic.scheduleBadge === 'today';
                    const isTomorrow = topic.scheduleBadge === 'tomorrow';

                    return (
                      <div
                        key={topic.id}
                        className={`card-lift rounded-2xl border-2 p-4 flex flex-col justify-between gap-3.5 ${
                          isToday
                            ? 'bg-emerald-50/70 border-emerald-400 shadow-sm'
                            : isTomorrow
                              ? 'bg-sky-50/60 border-sky-300'
                              : topic.completed
                                ? 'bg-white border-emerald-200'
                                : 'bg-white border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <div className="space-y-2.5">
                          {/* Верхняя строка: номер + метки статуса */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0 ${
                                  topic.completed
                                    ? 'bg-emerald-500 text-white'
                                    : isToday
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {topic.completed ? '✓' : topic.order_index}
                              </span>

                              {isToday && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold">
                                  ● Сегодня
                                </span>
                              )}
                              {isTomorrow && (
                                <span className="px-2 py-0.5 rounded-full bg-sky-500 text-white text-[10px] font-extrabold">
                                  Завтра
                                </span>
                              )}
                              {topic.is_assessment && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                                  🏆 СОР/СОЧ
                                </span>
                              )}
                            </div>

                            {/* Звёзды урока */}
                            <div
                              className="flex items-center gap-0.5 text-sm shrink-0"
                              title={`Звёзды: ${stars.earned} из ${stars.possible}`}
                            >
                              <span
                                className={
                                  stars.theoryStar ? 'opacity-100' : 'opacity-25 grayscale'
                                }
                              >
                                ⭐
                              </span>
                              <span
                                className={
                                  stars.simStar ? 'opacity-100' : 'opacity-25 grayscale'
                                }
                              >
                                ⭐
                              </span>
                              {topic.hwTotal > 0 && (
                                <span
                                  className={
                                    stars.hwStar ? 'opacity-100' : 'opacity-25 grayscale'
                                  }
                                >
                                  ⭐
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Название и жизненная зацепка */}
                          <div>
                            <Link
                              href={`/courses/${selectedCourse.slug}?topic=${topic.id}`}
                              prefetch={false}
                              className="text-sm sm:text-[15px] font-extrabold text-slate-900 hover:text-indigo-700 leading-snug line-clamp-2 block transition"
                            >
                              {topic.title}
                            </Link>
                            {topic.value_example && (
                              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                💡 {topic.value_example}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Нижние удобные кнопки быстрого входа */}
                        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/courses/${selectedCourse.slug}?topic=${topic.id}&tab=interactive`}
                              prefetch={false}
                              title="Перейти сразу к тренажёру"
                              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition ${
                                stars.simStar
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700'
                              }`}
                            >
                              🎮 {topic.simSolved > 0 ? topic.simSolved : 'Игра'}
                            </Link>

                            {topic.hwTotal > 0 && (
                              <Link
                                href={`/courses/${selectedCourse.slug}?topic=${topic.id}&tab=homework`}
                                prefetch={false}
                                title="Перейти сразу к ДЗ"
                                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition ${
                                  stars.hwStar
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                                }`}
                              >
                                📝 {topic.hwDone}/{topic.hwTotal}
                              </Link>
                            )}
                          </div>

                          <Link
                            href={`/courses/${selectedCourse.slug}?topic=${topic.id}`}
                            prefetch={false}
                            className={`btn-tactile px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                              isToday
                                ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-800 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-800 text-white'
                            }`}
                          >
                            Открыть →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}