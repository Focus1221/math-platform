'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useGamification } from '@/hooks/useGamification';
import { PRACTICE_STAR_TARGET } from '@/lib/gamification';
import GamificationHeader from '@/components/gamification/GamificationHeader';
import ThemePicker from '@/components/layout/ThemePicker';
import TheoryTab from './TheoryTab';
import InteractiveTab from './InteractiveTab';
import HomeworkTab from './HomeworkTab';
import AiTutorTab from './AiTutorTab';
import TopicEditorModal from './TopicEditorModal';
import ScheduleTopicModal from './ScheduleTopicModal';
import BoardDrawOverlay from './BoardDrawOverlay';
import ConfettiBurst from '@/components/ui/ConfettiBurst';
import { cleanSectionName, getScheduleBadge } from '@/lib/format/cleanTopic';
import { isSoundEnabled, playSound, setSoundEnabled } from '@/lib/audio/sound';
import type {
  ClassScheduleItem,
  Course,
  Material,
  Profile,
  Topic,
} from '@/types/db';

interface ClassroomOption {
  id: string;
  name: string;
  join_code: string;
}

interface Props {
  course: Course;
  initialTopics: Topic[];
  initialCompletedIds: string[];
  profile: Profile | null;
  classrooms?: ClassroomOption[];
  initialSchedules?: ClassScheduleItem[];
  initialTopicId?: string;
  initialTab?: string;
}

type TabId = 'theory' | 'interactive' | 'homework' | 'passport';

const LAST_LESSON_STORAGE_KEY = 'mathhub_last_lesson';

function syncLessonUrl(topicId: string, tab: TabId) {
  if (typeof window === 'undefined' || !topicId) return;
  const url = new URL(window.location.href);
  url.searchParams.set('topic', topicId);
  if (tab === 'passport') {
    url.searchParams.delete('tab');
  } else {
    url.searchParams.set('tab', tab);
  }
  const nextHref = `${url.pathname}${url.search}${url.hash}`;
  const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextHref !== currentHref) {
    window.history.replaceState(null, '', nextHref);
  }
}

export default function CourseWorkspace({
  course,
  initialTopics,
  initialCompletedIds,
  profile,
  classrooms = [],
  initialSchedules = [],
  initialTopicId,
  initialTab,
}: Props) {
  const supabase = createClient();
  const isTeacher = profile?.role === 'teacher';

  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [schedules, setSchedules] = useState<ClassScheduleItem[]>(initialSchedules);
  const [teacherMode, setTeacherMode] = useState(false);
  const [teacherMenuOpen, setTeacherMenuOpen] = useState(false);
  const [boardMode, setBoardMode] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [confettiKey, setConfettiKey] = useState(0);

  const {
    stats,
    starsMap,
    rewardBanner,
    markSlidesDone,
    reportPracticeSolved,
    markHomeworkDone,
  } = useGamification(Boolean(profile));

  const initialMatchedTopic =
    initialTopics.find((t) => t.id === initialTopicId) ||
    initialTopics[0] ||
    null;

  const [activeQuarter, setActiveQuarter] = useState<number>(
    initialMatchedTopic?.quarter || 1
  );
  const [activeTopicId, setActiveTopicId] = useState<string>(
    initialMatchedTopic?.id || ''
  );
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (initialTab === 'interactive' || initialTab === 'homework') {
      return initialTab;
    }
    return 'theory';
  });

  // Локальная отметка пройденных слайдов (работает и для гостей)
  const [slidesDoneIds, setSlidesDoneIds] = useState<string[]>([]);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'assessment' | 'completed'>('all');
  const [completedIds, setCompletedIds] = useState<string[]>(initialCompletedIds);
  const [editingTopicModal, setEditingTopicModal] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [notesDraft, setNotesDraft] = useState('');
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicSection, setNewTopicSection] = useState('');

  const tabsNavRef = useRef<HTMLElement | null>(null);
  const teacherMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSoundOn(isSoundEnabled());

    function handleClickOutside(e: MouseEvent) {
      if (
        teacherMenuRef.current &&
        !teacherMenuRef.current.contains(e.target as Node)
      ) {
        setTeacherMenuOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        setTeacherMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // Синхронизация темы и вкладки при переходе с экрана «Сегодня» или «Карты тем»
  useEffect(() => {
    if (initialTopicId) {
      const matched = initialTopics.find((t) => t.id === initialTopicId);
      if (matched) {
        setActiveTopicId(matched.id);
        setActiveQuarter(matched.quarter);
      }
    }
    if (
      initialTab === 'interactive' ||
      initialTab === 'homework' ||
      initialTab === 'theory'
    ) {
      setActiveTab(initialTab);
      if (initialTab !== 'theory') {
        const timer = setTimeout(() => {
          tabsNavRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 180);
        return () => clearTimeout(timer);
      }
    }
  }, [initialTopicId, initialTab, initialTopics]);

  function toggleSound() {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
    if (next) playSound('click');
  }

  const orderedTopics = useMemo(
    () => [...topics].sort((a, b) => a.order_index - b.order_index),
    [topics]
  );

  const activeTopic = useMemo(
    () =>
      orderedTopics.find((t) => t.id === activeTopicId) ||
      orderedTopics[0] ||
      null,
    [orderedTopics, activeTopicId]
  );

  const activeIndex = activeTopic
    ? orderedTopics.findIndex((t) => t.id === activeTopic.id)
    : -1;
  const prevTopic = activeIndex > 0 ? orderedTopics[activeIndex - 1] : null;
  const nextTopic =
    activeIndex >= 0 && activeIndex < orderedTopics.length - 1
      ? orderedTopics[activeIndex + 1]
      : null;

  const topicBadgeMap = useMemo(() => {
    const map = new Map<string, 'today' | 'tomorrow'>();
    for (const s of schedules) {
      const b = getScheduleBadge(s.lesson_date);
      if (b === 'today') {
        map.set(s.topic_id, 'today');
      } else if (b === 'tomorrow' && map.get(s.topic_id) !== 'today') {
        map.set(s.topic_id, 'tomorrow');
      }
    }
    return map;
  }, [schedules]);

  // Обновляем URL и запоминаем последний открытый урок для экрана «Сегодня»
  useEffect(() => {
    if (!activeTopic) return;
    syncLessonUrl(activeTopic.id, activeTab);
    try {
      const safeTab = activeTab === 'passport' ? 'theory' : activeTab;
      window.localStorage.setItem(
        LAST_LESSON_STORAGE_KEY,
        JSON.stringify({
          courseId: course.id,
          courseTitle: course.title,
          pathname: window.location.pathname,
          topicId: activeTopic.id,
          topicTitle: activeTopic.title,
          orderIndex: activeTopic.order_index,
          quarter: activeTopic.quarter,
          tab: safeTab,
          updatedAt: Date.now(),
        })
      );
    } catch {
      // Игнорируем ограничения приватного режима
    }
  }, [
    activeTopic?.id,
    activeTopic?.title,
    activeTopic?.order_index,
    activeTopic?.quarter,
    activeTab,
    course.id,
    course.title,
  ]);

  function goToTopic(topic: Topic) {
    playSound('click');
    setActiveTopicId(topic.id);
    setActiveQuarter(topic.quarter);
    setActiveTab('theory');
    syncLessonUrl(topic.id, 'theory');
    setDrawerOpen(false);
    setTutorOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function switchTab(nextTab: TabId, scrollToTabs = false) {
    playSound('click');
    setActiveTab(nextTab);
    if (activeTopic) {
      syncLessonUrl(activeTopic.id, nextTab);
    }
    if (scrollToTabs) {
      setTimeout(() => {
        tabsNavRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  }

  function toggleBoardMode() {
    setBoardMode((prev) => {
      const next = !prev;
      if (next) {
        setTeacherMode(false);
        setDrawerOpen(false);
        setTutorOpen(false);
        setTeacherMenuOpen(false);
      }
      return next;
    });
  }

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

  useEffect(() => {
    if (!teacherMode && activeTab === 'passport') {
      setActiveTab('theory');
    }
  }, [teacherMode, activeTab]);

  const groupedTopics = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = orderedTopics.filter((t) => {
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
      const secName = teacherMode ? t.section : cleanSectionName(t.section);
      if (!map.has(secName)) map.set(secName, []);
      map.get(secName)!.push(t);
    });
    return map;
  }, [orderedTopics, activeQuarter, search, filter, completedIds, teacherMode]);

  const progressPercent = topics.length
    ? Math.round((completedIds.length / topics.length) * 100)
    : 0;

  async function autoCompleteTopic(topicId: string) {
    if (!profile || completedIds.includes(topicId)) return;
    setCompletedIds((prev) => (prev.includes(topicId) ? prev : [...prev, topicId]));
    playSound('celebrate');
    setConfettiKey((k) => k + 1);
    await supabase.from('topic_progress').upsert({
      student_id: profile.id,
      topic_id: topicId,
      completed: true,
      updated_at: new Date().toISOString(),
    });
  }

  async function toggleComplete(topicId: string) {
    if (!profile) {
      alert('Войди в аккаунт, чтобы сохранять прогресс.');
      return;
    }
    const nextDone = !completedIds.includes(topicId);
    if (nextDone) {
      playSound('celebrate');
      setConfettiKey((k) => k + 1);
    } else {
      playSound('click');
    }
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

  function handlePracticeSolved(totalSolved: number) {
    if (!activeTopic) return;
    const current = starsMap[activeTopic.id];
    const becameDone = !current?.practice_done && totalSolved >= PRACTICE_STAR_TARGET;
    if (becameDone) {
      setConfettiKey((k) => k + 1);
    }
    reportPracticeSolved(activeTopic.id, totalSolved);

    const hasSlides =
      Boolean(current?.slides_done) || slidesDoneIds.includes(activeTopic.id);
    const hasPractice =
      Boolean(current?.practice_done) || totalSolved >= PRACTICE_STAR_TARGET;
    const hasHomework = Boolean(current?.homework_done);
    if (hasSlides && hasPractice && hasHomework) {
      void autoCompleteTopic(activeTopic.id);
    }
  }

  function handleSlidesCompleted() {
    if (!activeTopic) return;
    const current = starsMap[activeTopic.id];
    if (!current?.slides_done) {
      setConfettiKey((k) => k + 1);
    }
    setSlidesDoneIds((prev) =>
      prev.includes(activeTopic.id) ? prev : [...prev, activeTopic.id]
    );
    markSlidesDone(activeTopic.id);

    if (current?.practice_done && current?.homework_done) {
      void autoCompleteTopic(activeTopic.id);
    }
  }

  function handleHomeworkDone() {
    if (!activeTopic) return;
    const current = starsMap[activeTopic.id];
    if (!current?.homework_done) {
      setConfettiKey((k) => k + 1);
    }
    markHomeworkDone(activeTopic.id);

    const hasSlides =
      Boolean(current?.slides_done) || slidesDoneIds.includes(activeTopic.id);
    if (hasSlides && current?.practice_done) {
      void autoCompleteTopic(activeTopic.id);
    }
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
        section:
          newTopicSection.trim() || `Раздел ${activeQuarter} четверти`,
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
      setDrawerOpen(false);
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
      playSound('success');
      alert('Заметки сохранены!');
    }
  }

  const activeObjectives = Array.isArray(activeTopic?.objectives)
    ? activeTopic.objectives
    : [];
  const activeScheduleBadge = activeTopic
    ? topicBadgeMap.get(activeTopic.id)
    : undefined;

  const activeStars = activeTopic ? starsMap[activeTopic.id] : undefined;
  const isTopicDone = activeTopic ? completedIds.includes(activeTopic.id) : false;

  // Каждая звезда зажигается честно по своему шагу (без автоподстановки от isTopicDone)
  const slidesStar = activeTopic
    ? Boolean(activeStars?.slides_done) || slidesDoneIds.includes(activeTopic.id)
    : false;
  const practiceStar = Boolean(activeStars?.practice_done);
  const homeworkStar = Boolean(activeStars?.homework_done);

  const solvedCount = Math.min(
    PRACTICE_STAR_TARGET,
    Number(activeStars?.practice_solved || 0)
  );
  const earnedStarsCount =
    (slidesStar ? 1 : 0) + (practiceStar ? 1 : 0) + (homeworkStar ? 1 : 0);

  const showStarSubs = !boardMode && !teacherMode && Boolean(profile);

  const tabs: {
    id: TabId;
    icon: string;
    label: string;
    shortLabel: string;
    sub?: string;
    star?: boolean;
  }[] = teacherMode
    ? [
        {
          id: 'theory',
          icon: '📘',
          label: '1. Понять',
          shortLabel: 'Понять',
          star: slidesStar,
        },
        {
          id: 'interactive',
          icon: '🎮',
          label: '2. Потренироваться',
          shortLabel: 'Тренажёр',
          star: practiceStar,
        },
        {
          id: 'homework',
          icon: '📝',
          label: '3. Сдать ДЗ',
          shortLabel: 'ДЗ',
          star: homeworkStar,
        },
        {
          id: 'passport',
          icon: '📋',
          label: 'Паспорт КТП',
          shortLabel: 'КТП',
        },
      ]
    : [
        {
          id: 'theory',
          icon: '📘',
          label: '1. Понять',
          shortLabel: 'Понять',
          sub: slidesStar ? 'Пройдено' : 'Дойди до конца',
          star: slidesStar,
        },
        {
          id: 'interactive',
          icon: '🎮',
          label: '2. Потренироваться',
          shortLabel: 'Тренажёр',
          sub: practiceStar
            ? 'Зачтено'
            : `Решено ${solvedCount} из ${PRACTICE_STAR_TARGET}`,
          star: practiceStar,
        },
        {
          id: 'homework',
          icon: '📝',
          label: '3. Сдать ДЗ',
          shortLabel: 'ДЗ',
          sub: homeworkStar ? 'Сдано' : 'Отправь ответы',
          star: homeworkStar,
        },
      ];

  return (
    <div className="min-h-screen flex flex-col">
      <ConfettiBurst burstKey={confettiKey} />

      {/* Чистая эргономичная шапка */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {!boardMode && (
              <button
                type="button"
                onClick={() => {
                  playSound('click');
                  setDrawerOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-extrabold border border-slate-200 transition shrink-0"
                title="Открыть список всех уроков курса"
              >
                <span>🗺️</span>
                <span className="hidden sm:inline">Все темы</span>
              </button>
            )}

            <Link
              href="/today"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white flex items-center justify-center font-extrabold text-sm sm:text-base shrink-0 shadow-xs"
              title="На экран «Сегодня»"
            >
              ∑{course.grade_number}
            </Link>

            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                {course.title}
              </h1>
              <p className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                <Link
                  href="/today"
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Сегодня
                </Link>
                <span>·</span>
                <Link href="/courses" className="hover:underline font-semibold">
                  Карта тем
                </Link>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Выбор стиля оформления */}
            <ThemePicker compact />

            {/* Звук */}
            <button
              type="button"
              onClick={toggleSound}
              title={soundOn ? 'Выключить звуки' : 'Включить звуки'}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center text-sm transition ${
                soundOn
                  ? 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
            >
              {soundOn ? '🔊' : '🔇'}
            </button>

            {/* Режим проектора / доски */}
            <button
              type="button"
              onClick={toggleBoardMode}
              title="Режим проектора с маркером"
              className={`px-2.5 sm:px-3 py-2 rounded-xl border text-xs font-extrabold whitespace-nowrap transition ${
                boardMode
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
            >
              {boardMode ? '✕ Обычный вид' : '🖥️ Доска'}
            </button>

            {/* Компактное меню учителя */}
            {isTeacher && !boardMode && (
              <div className="relative" ref={teacherMenuRef}>
                <button
                  type="button"
                  onClick={() => setTeacherMenuOpen((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-extrabold transition ${
                    teacherMode || teacherMenuOpen
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                  }`}
                >
                  <span>{teacherMode ? '🛠️' : '👨‍🏫'}</span>
                  <span className="hidden sm:inline">
                    {teacherMode ? 'Редактор вкл' : 'Учитель'}
                  </span>
                  <span className="text-[10px]">▾</span>
                </button>

                {teacherMenuOpen && (
                  <div className="theme-popover absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 space-y-1 z-50 animate-pop">
                    <button
                      type="button"
                      onClick={() => {
                        setTeacherMode((v) => !v);
                        setTeacherMenuOpen(false);
                      }}
                      className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-extrabold transition ${
                        teacherMode
                          ? 'bg-indigo-600 text-white'
                          : 'hover:bg-indigo-50 text-slate-800'
                      }`}
                    >
                      <span>🛠️ Режим редактора</span>
                      <span className="text-[10px] opacity-80">
                        {teacherMode ? 'ВКЛ' : 'ВЫКЛ'}
                      </span>
                    </button>

                    {activeTopic && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setScheduleModalOpen(true);
                            setTeacherMenuOpen(false);
                          }}
                          className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-emerald-50 text-xs font-bold text-slate-800"
                        >
                          <span>📅</span>
                          <span>Назначить урок классу</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTopicModal(true);
                            setTeacherMenuOpen(false);
                          }}
                          className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800"
                        >
                          <span>⚙️</span>
                          <span>Настроить тему и симулятор</span>
                        </button>
                      </>
                    )}

                    <div className="border-t border-slate-100 my-1" />

                    <Link
                      href="/teacher/journal"
                      onClick={() => setTeacherMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-indigo-50 text-xs font-bold text-slate-800"
                    >
                      <span>📊</span>
                      <span>Журнал и PIN-карточки</span>
                    </Link>
                    <Link
                      href="/teacher/submissions"
                      onClick={() => setTeacherMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-amber-50 text-xs font-bold text-slate-800"
                    >
                      <span>📥</span>
                      <span>Проверка ДЗ по классам</span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {!profile && !boardMode && (
              <Link
                href="/login"
                className="btn-tactile px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 text-white text-xs font-extrabold whitespace-nowrap"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Выезжающая шторка «Все темы» */}
      {!boardMode && drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex"
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="w-[310px] sm:w-[350px] max-w-[90vw] h-full bg-white border-r border-slate-200 shadow-2xl flex flex-col animate-pop"
          >
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-extrabold text-slate-900">
                  🗺️ Все темы курса
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">Прогресс по курсу</span>
                  <span className="text-emerald-600 font-extrabold tabular-nums">
                    {progressPercent}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  Пройдено {completedIds.length} из {topics.length} уроков
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setActiveQuarter(q)}
                    className={`py-2 rounded-xl text-xs font-extrabold border transition ${
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
                placeholder={
                  teacherMode ? 'Поиск темы или кода ЦО...' : 'Найти тему...'
                }
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
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition ${
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
                  <summary className="cursor-pointer list-none px-2.5 py-2 rounded-xl bg-slate-50 text-xs font-extrabold text-slate-800 flex justify-between">
                    <span className="truncate">{section}</span>
                    <span className="text-[10px] text-slate-500 ml-2">
                      {secTopics.length}
                    </span>
                  </summary>
                  <div className="mt-1.5 space-y-1 pl-1">
                    {secTopics.map((t) => {
                      const isActive = t.id === activeTopic?.id;
                      const isDone = completedIds.includes(t.id);
                      const badge = topicBadgeMap.get(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => goToTopic(t)}
                          className={`w-full text-left p-2.5 rounded-xl border transition flex items-start gap-2 ${
                            isActive
                              ? 'bg-indigo-50 border-indigo-400'
                              : badge === 'today'
                                ? 'bg-emerald-50/70 border-emerald-300 hover:bg-emerald-50'
                                : badge === 'tomorrow'
                                  ? 'bg-sky-50/60 border-sky-200 hover:bg-sky-50'
                                  : 'bg-white border-transparent hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5 ${
                              isDone
                                ? 'bg-emerald-500 text-white'
                                : badge === 'today'
                                  ? 'bg-emerald-600 text-white'
                                  : isActive
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {isDone ? '✓' : t.order_index}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-800 leading-snug">
                              {t.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {badge === 'today' && (
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500 text-white text-[9px] font-extrabold">
                                  ● Сегодня
                                </span>
                              )}
                              {badge === 'tomorrow' && (
                                <span className="px-1.5 py-0.5 rounded-md bg-sky-500 text-white text-[9px] font-extrabold">
                                  Завтра
                                </span>
                              )}
                              {t.is_assessment && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[9px] font-extrabold">
                                  🏆 СОР/СОЧ
                                </span>
                              )}
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
                  <div className="text-[11px] font-extrabold text-indigo-800">
                    + Новая тема ({activeQuarter} ч.)
                  </div>
                  <input
                    type="text"
                    value={newTopicSection}
                    onChange={(e) => setNewTopicSection(e.target.value)}
                    placeholder="Раздел (напр. 5.1А Натуральные числа)"
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
                    className="w-full py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-extrabold"
                  >
                    Добавить тему
                  </button>
                </form>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Просторная центральная зона урока */}
      <main className="flex-1 w-full px-3 sm:px-6 pt-4 pb-28">
        {!activeTopic ? (
          <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3">
            <div className="text-4xl">📚</div>
            <h2 className="text-lg font-extrabold text-slate-900">
              В этом курсе пока нет тем
            </h2>
            <p className="text-sm text-slate-500">
              Открой «👨‍🏫 Учитель → Режим редактора» и добавь первую тему через «🗺️ Все темы».
            </p>
          </div>
        ) : (
          <div
            className={`mx-auto space-y-3.5 ${
              boardMode ? 'max-w-7xl' : 'max-w-5xl'
            }`}
          >
            {/* Панель геймификации: уровень, XP, стрик и награды */}
            {!boardMode && !teacherMode && profile && (
              <GamificationHeader stats={stats} rewardBanner={rewardBanner} />
            )}

            {/* Живая компактная карточка урока */}
            <section
              className={`bg-white rounded-3xl border-2 shadow-xs p-4 sm:p-5 space-y-3 ${
                activeScheduleBadge === 'today'
                  ? 'border-emerald-400'
                  : activeScheduleBadge === 'tomorrow'
                    ? 'border-sky-300'
                    : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {activeScheduleBadge === 'today' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-extrabold">
                        ● Урок сегодня
                      </span>
                    )}
                    {activeScheduleBadge === 'tomorrow' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-sky-500 text-white font-extrabold">
                        Завтра
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700">
                      {activeTopic.quarter} четверть
                    </span>
                    <span className="font-bold text-indigo-600">
                      {teacherMode
                        ? activeTopic.section
                        : cleanSectionName(activeTopic.section)}
                    </span>
                    {activeTopic.is_assessment && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold">
                        🏆 СОР / СОЧ
                      </span>
                    )}
                  </div>

                  <h2
                    className={`font-extrabold text-slate-900 leading-tight ${
                      boardMode ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-2xl'
                    }`}
                  >
                    {activeTopic.order_index}. {activeTopic.title}
                  </h2>
                </div>

                {/* Кнопка завершения урока */}
                {!boardMode && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleComplete(activeTopic.id)}
                      className={`btn-tactile px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold ${
                        isTopicDone
                          ? 'bg-emerald-500 border-emerald-700 text-white'
                          : 'bg-slate-900 hover:bg-indigo-600 border-slate-950 text-white'
                      }`}
                    >
                      {isTopicDone ? '✓ Урок пройден' : '○ Отметить пройденным'}
                    </button>
                  </div>
                )}
              </div>

              {activeTopic.value_example && (
                <div
                  className={`px-3.5 py-2.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 text-indigo-900 ${
                    boardMode ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                  }`}
                >
                  <strong>💡 Задача из жизни:</strong> {activeTopic.value_example}
                </div>
              )}
            </section>

            {/* Объединённая квест-панель: 3 шага урока + звёзды прогресса */}
            <nav
              ref={tabsNavRef}
              className="scroll-mt-20 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5"
            >
              <div
                className={`grid gap-1.5 flex-1 ${
                  teacherMode ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
                }`}
              >
                {tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => switchTab(tab.id)}
                      className={`px-2.5 sm:px-3.5 py-2 rounded-xl transition flex items-center justify-center sm:justify-start gap-2 text-left ${
                        active
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs'
                          : tab.star
                            ? 'bg-amber-50/70 border border-amber-200 text-amber-950 hover:border-amber-300'
                            : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-base leading-none shrink-0">
                        {tab.star ? '⭐' : tab.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-extrabold truncate leading-tight">
                          <span className="sm:hidden">{tab.shortLabel}</span>
                          <span className="hidden sm:inline">{tab.label}</span>
                        </div>
                        {showStarSubs && tab.sub && (
                          <div
                            className={`text-[10px] font-semibold truncate hidden sm:block mt-0.5 ${
                              active ? 'text-white/80' : 'opacity-70'
                            }`}
                          >
                            {tab.sub}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {showStarSubs && (
                <div
                  className={`px-3 py-1.5 sm:py-2.5 rounded-xl text-xs font-extrabold text-center shrink-0 tabular-nums ${
                    earnedStarsCount === 3
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                  title="Звёзды, собранные в этом уроке"
                >
                  {earnedStarsCount === 3
                    ? '🏆 3 / 3'
                    : `⭐ ${earnedStarsCount} / 3`}
                </div>
              )}
            </nav>

            {/* Содержимое активного шага */}
            {activeTab === 'theory' && (
              <TheoryTab
                topic={activeTopic}
                materials={materials}
                canEdit={teacherMode}
                boardMode={boardMode}
                onTopicUpdated={(upd) =>
                  setTopics((prev) =>
                    prev.map((t) => (t.id === upd.id ? upd : t))
                  )
                }
                onMaterialsChanged={setMaterials}
                onSlidesCompleted={handleSlidesCompleted}
                onGoToPractice={() => switchTab('interactive', true)}
              />
            )}

            {activeTab === 'interactive' && (
              <div className="space-y-4">
                <InteractiveTab
                  topic={activeTopic}
                  materials={materials}
                  canEdit={teacherMode}
                  profile={profile}
                  isTopicCompleted={isTopicDone}
                  onMaterialsChanged={setMaterials}
                  onProblemSolved={handlePracticeSolved}
                />

                {!boardMode && (
                  <div className="rounded-3xl bg-white border border-slate-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs sm:text-sm font-bold text-slate-700">
                      Потренировался? Самое время проверить себя в домашнем задании!
                    </div>
                    <button
                      type="button"
                      onClick={() => switchTab('homework', true)}
                      className="btn-tactile px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 border-amber-700 text-white text-xs sm:text-sm font-extrabold"
                    >
                      📝 Перейти к ДЗ →
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'homework' && (
              <div className="space-y-4">
                <HomeworkTab
                  topic={activeTopic}
                  canEdit={teacherMode}
                  profile={profile}
                  onHomeworkSubmitted={handleHomeworkDone}
                />

                {!boardMode && !isTopicDone && (
                  <div className="rounded-3xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs sm:text-sm font-bold text-emerald-900">
                      Всё разобрал и отправил ДЗ? Отметь урок пройденным!
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleComplete(activeTopic.id)}
                      className="btn-tactile px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 border-emerald-800 text-white text-xs sm:text-sm font-extrabold"
                    >
                      ⭐ Завершить урок
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'passport' && teacherMode && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
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
                  <h4 className="text-xs font-extrabold uppercase text-slate-500">
                    Методические заметки учителя
                  </h4>
                  <textarea
                    rows={4}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl"
                  />
                  <button
                    type="button"
                    onClick={saveTeacherNotes}
                    className="btn-tactile px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 text-white text-xs font-extrabold"
                  >
                    💾 Сохранить заметки
                  </button>
                </div>
              </div>
            )}

            {/* Удобная навигация между уроками */}
            {(prevTopic || nextTopic) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {prevTopic ? (
                  <button
                    type="button"
                    onClick={() => goToTopic(prevTopic)}
                    className="card-lift text-left p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-xs transition group"
                  >
                    <div className="text-[11px] font-bold text-slate-400 group-hover:text-indigo-600">
                      ← Предыдущий урок
                      {prevTopic.quarter !== activeTopic.quarter
                        ? ` (${prevTopic.quarter} четв.)`
                        : ''}
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold text-slate-800 mt-0.5 line-clamp-1">
                      {prevTopic.order_index}. {prevTopic.title}
                    </div>
                  </button>
                ) : (
                  <div />
                )}

                {nextTopic && (
                  <button
                    type="button"
                    onClick={() => goToTopic(nextTopic)}
                    className="card-lift text-right p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-xs transition group"
                  >
                    <div className="text-[11px] font-bold text-slate-400 group-hover:text-indigo-600">
                      Следующий урок
                      {nextTopic.quarter !== activeTopic.quarter
                        ? ` (${nextTopic.quarter} четв.)`
                        : ''}{' '}
                      →
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold text-slate-800 mt-0.5 line-clamp-1">
                      {nextTopic.order_index}. {nextTopic.title}
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Живая кнопка совы Сократа */}
      {!boardMode && activeTopic && (
        <button
          type="button"
          onClick={() => {
            playSound('click');
            setTutorOpen(true);
          }}
          className={`fixed bottom-5 right-5 z-40 btn-tactile px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 text-xs sm:text-sm font-extrabold ${
            activeTopic.is_assessment
              ? 'bg-amber-100 text-amber-900 border-amber-300'
              : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-indigo-900'
          }`}
        >
          <span className="text-lg leading-none animate-float">
            {activeTopic.is_assessment ? '🔒' : '🦉'}
          </span>
          <span className="hidden sm:inline">
            {activeTopic.is_assessment
              ? 'СОР / СОЧ'
              : activeTab === 'homework'
                ? 'Подсказка от Сократа'
                : 'Спросить Сократа'}
          </span>
        </button>
      )}

      {/* Окно ИИ-тьютора «Сократ» */}
      {tutorOpen && activeTopic && (
        <div
          onClick={() => setTutorOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl relative animate-pop"
          >
            <button
              type="button"
              onClick={() => setTutorOpen(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold"
              title="Закрыть"
            >
              ✕
            </button>
            <AiTutorTab
              topic={activeTopic}
              profile={profile}
              onGoToTheory={() => {
                setActiveTab('theory');
                setTutorOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {boardMode && (
        <BoardDrawOverlay onExitBoard={() => setBoardMode(false)} />
      )}

      {scheduleModalOpen && activeTopic && (
        <ScheduleTopicModal
          topic={activeTopic}
          classrooms={classrooms}
          schedules={schedules}
          onClose={() => setScheduleModalOpen(false)}
          onSaved={(item) => {
            setSchedules((prev) => {
              const filtered = prev.filter(
                (s) =>
                  !(
                    s.classroom_id === item.classroom_id &&
                    s.topic_id === item.topic_id
                  )
              );
              return [...filtered, item];
            });
          }}
          onDeleted={(classroomId, topicId) => {
            setSchedules((prev) =>
              prev.filter(
                (s) =>
                  !(s.classroom_id === classroomId && s.topic_id === topicId)
              )
            );
          }}
        />
      )}

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