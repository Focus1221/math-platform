'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import AppNav from '@/components/layout/AppNav';
import { cleanSectionName, formatShortRuDate } from '@/lib/format/cleanTopic';
import type { Course, Profile } from '@/types/db';

export interface TodayScheduleCard {
  id: string;
  classroomId: string;
  classroomName: string;
  topicId: string;
  topicOrder: number;
  topicTitle: string;
  topicSection: string;
  topicValueExample: string;
  isAssessment: boolean;
  courseSlug: string;
  courseTitle: string;
  lessonDate: string;
  hwDueDate: string | null;
  note: string;
  totalTasks: number;
  doneTasks: number;
  earnedPoints: number;
  maxPoints: number;
  isCompleted: boolean;
}

export interface RecentGradedCard {
  id: string;
  topicId: string;
  topicTitle: string;
  courseSlug: string;
  score: number;
  maxPoints: number;
  teacherComment: string;
}

interface ClassroomOption {
  id: string;
  name: string;
  join_code: string;
}

interface Props {
  profile: Profile | null;
  studentClassroom: ClassroomOption | null;
  teacherClassrooms: ClassroomOption[];
  schedules: TodayScheduleCard[];
  recentGraded: RecentGradedCard[];
  courses: Course[];
  stats: {
    completedTopics: number;
    simSolved: number;
    bestStreak: number;
  };
  todayIso: string;
  tomorrowIso: string;
}

const QUICK_SIMS = [
  { id: 'fractions_visual', icon: '🍕', name: 'Пицца дробей', desc: 'Доли и сравнение' },
  { id: 'divisibility', icon: '⚡', name: 'Блиц: Делимость', desc: 'На 2, 3, 5, 9, 10' },
  { id: 'percent_grid', icon: '💯', name: 'Проценты 10×10', desc: 'Сетка и дроби' },
  { id: 'diagrams', icon: '📊', name: 'Диаграммы', desc: 'Круги и столбцы' },
];

export default function TodayClient({
  profile,
  studentClassroom,
  teacherClassrooms,
  schedules,
  recentGraded,
  courses,
  stats,
  todayIso,
  tomorrowIso,
}: Props) {
  const isTeacher = profile?.role === 'teacher';
  const [selectedClassId, setSelectedClassId] = useState<string>(
    teacherClassrooms[0]?.id || ''
  );

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || '';
  const defaultCourse = courses[0] || null;

  const filteredSchedules = useMemo(() => {
    if (isTeacher && selectedClassId) {
      return schedules.filter((s) => s.classroomId === selectedClassId);
    }
    return schedules;
  }, [isTeacher, selectedClassId, schedules]);

  const todayLessons = useMemo(
    () => filteredSchedules.filter((s) => s.lessonDate === todayIso),
    [filteredSchedules, todayIso]
  );

  const tomorrowLessons = useMemo(
    () => filteredSchedules.filter((s) => s.lessonDate === tomorrowIso),
    [filteredSchedules, tomorrowIso]
  );

  const upcomingLessons = useMemo(
    () =>
      filteredSchedules
        .filter((s) => s.lessonDate > tomorrowIso)
        .sort((a, b) => a.lessonDate.localeCompare(b.lessonDate))
        .slice(0, 3),
    [filteredSchedules, tomorrowIso]
  );

  const activeHomework = useMemo(() => {
    return filteredSchedules
      .filter((s) => s.totalTasks > 0 && (s.hwDueDate || s.lessonDate >= todayIso))
      .sort((a, b) =>
        (a.hwDueDate || a.lessonDate).localeCompare(b.hwDueDate || b.lessonDate)
      );
  }, [filteredSchedules, todayIso]);

  function getDueBadge(dueDate: string | null) {
    if (!dueDate) {
      return { label: 'Домашнее задание', cls: 'bg-amber-100 text-amber-800' };
    }
    if (dueDate < todayIso) {
      return {
        label: `Просрочено (${formatShortRuDate(dueDate)})`,
        cls: 'bg-rose-100 text-rose-700',
      };
    }
    if (dueDate === todayIso) {
      return { label: 'Сдать сегодня', cls: 'bg-amber-500 text-white' };
    }
    if (dueDate === tomorrowIso) {
      return { label: 'Сдать до завтра', cls: 'bg-amber-100 text-amber-900' };
    }
    return {
      label: `Сдать до ${formatShortRuDate(dueDate)}`,
      cls: 'bg-amber-100 text-amber-800',
    };
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav profile={profile} />

      <main className="max-w-5xl w-full mx-auto px-4 pt-6 pb-28 md:pb-10 space-y-6">
        {/* Приветствие и живая статистика */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {profile ? `Привет, ${firstName}!` : 'Добро пожаловать в MathHub'}
              </h1>
              {studentClassroom && (
                <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-extrabold">
                  {studentClassroom.name}
                </span>
              )}
              {isTeacher && (
                <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white text-xs font-bold">
                  👨‍🏫 Учитель
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {isTeacher
                ? 'Проверяй, что сегодня видят твои классы, или открой любой урок для назначения.'
                : 'Здесь собрано всё главное на сегодня, домашка и твои тренажёры.'}
            </p>
          </div>

          {isTeacher ? (
            teacherClassrooms.length > 0 && (
              <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-2xl border border-slate-200 shadow-xs shrink-0">
                <span className="text-xs font-bold text-slate-500">Класс:</span>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="text-xs sm:text-sm font-extrabold text-indigo-700 bg-transparent focus:outline-none cursor-pointer"
                >
                  {teacherClassrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.join_code})
                    </option>
                  ))}
                </select>
              </div>
            )
          ) : (
            profile && (
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="bg-white px-3.5 py-2 rounded-2xl border border-slate-200 shadow-xs text-center">
                  <div className="text-lg font-extrabold text-emerald-600 tabular-nums leading-none">
                    {stats.completedTopics}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                    тем пройдено
                  </div>
                </div>
                <div className="bg-white px-3.5 py-2 rounded-2xl border border-slate-200 shadow-xs text-center">
                  <div className="text-lg font-extrabold text-indigo-600 tabular-nums leading-none">
                    {stats.simSolved}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                    в тренажёрах
                  </div>
                </div>
              </div>
            )
          )}
        </section>

        {/* Если гость ещё не вошёл */}
        {!profile && (
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-extrabold">
                Войди в аккаунт своего класса
              </h2>
              <p className="text-xs sm:text-sm text-indigo-100">
                Тогда здесь появятся сегодняшние уроки, твои домашние задания и оценки учителя.
              </p>
            </div>
            <Link
              href="/login"
              className="btn-tactile px-5 py-3 rounded-2xl bg-white text-indigo-700 border-indigo-200 text-sm font-extrabold text-center shrink-0"
            >
              Войти или зарегистрироваться
            </Link>
          </div>
        )}

        {/* ГЛАВНЫЙ ФОКУС: УРОК СЕГОДНЯ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              На сегодня
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              {formatShortRuDate(todayIso)}
            </span>
          </div>

          {todayLessons.length > 0 ? (
            <div className="space-y-3">
              {todayLessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 rounded-3xl border-2 border-emerald-400 shadow-sm p-5 sm:p-6 space-y-4 animate-pop"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white font-extrabold">
                        ● Урок сегодня
                      </span>
                      <span className="font-bold text-emerald-800">
                        {cleanSectionName(lesson.topicSection)}
                      </span>
                      {lesson.isAssessment && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold">
                          🏆 СОР / СОЧ
                        </span>
                      )}
                    </div>
                    {lesson.isCompleted && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                        ✓ Пройдено
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                      {lesson.topicTitle}
                    </h3>
                    {lesson.note && (
                      <p className="mt-1.5 text-xs sm:text-sm font-semibold text-emerald-900 bg-emerald-100/70 px-3 py-2 rounded-xl">
                        💬 От учителя: {lesson.note}
                      </p>
                    )}
                    {lesson.topicValueExample && !lesson.note && (
                      <p className="mt-1.5 text-xs sm:text-sm text-slate-600 line-clamp-2">
                        {lesson.topicValueExample}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                      <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-200">
                        📘 Конспект
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-200">
                        🎮 Тренажёр
                      </span>
                      {lesson.totalTasks > 0 && (
                        <span className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold">
                          📝 ДЗ: {lesson.doneTasks}/{lesson.totalTasks}
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/courses/${lesson.courseSlug}?topic=${lesson.topicId}`}
                      prefetch={false}
                      className="btn-tactile px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 border-emerald-800 text-white text-sm font-extrabold shadow-xs"
                    >
                      Открыть урок →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-base font-extrabold text-slate-900">
                  {isTeacher
                    ? 'На сегодня для этого класса урок ещё не закреплён'
                    : 'На сегодня особых назначений нет'}
                </div>
                <p className="text-xs sm:text-sm text-slate-500">
                  {isTeacher
                    ? 'Открой любую тему в курсе в режиме «Редактор» и нажми «📅 Назначить классу» — карточка сразу загорится здесь зелёным.'
                    : 'Ты можешь открыть любую тему программы или потренироваться в симуляторах.'}
                </p>
              </div>
              {defaultCourse && (
                <Link
                  href={`/courses/${defaultCourse.slug}`}
                  prefetch={false}
                  className="btn-tactile px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 text-white text-xs sm:text-sm font-extrabold text-center shrink-0"
                >
                  Открыть {defaultCourse.title}
                </Link>
              )}
            </div>
          )}
        </section>

        {/* ДОМАШНИЕ ЗАДАНИЯ И ОЦЕНКИ */}
        {(activeHomework.length > 0 || recentGraded.length > 0) && (
          <section className="space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-700 flex items-center gap-2">
              <span>📝</span> Домашние задания
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {activeHomework.map((hw) => {
                const allDone = hw.doneTasks >= hw.totalTasks;
                const badge = getDueBadge(hw.hwDueDate);
                return (
                  <div
                    key={`hw-${hw.id}`}
                    className={`rounded-3xl border-2 p-5 flex flex-col justify-between gap-4 transition ${
                      allDone
                        ? 'bg-white border-emerald-200'
                        : 'bg-amber-50/40 border-amber-300 shadow-xs'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                            allDone ? 'bg-emerald-100 text-emerald-800' : badge.cls
                          }`}
                        >
                          {allDone ? '✓ Отправлено' : badge.label}
                        </span>
                        <span className="text-xs font-bold text-slate-500 tabular-nums">
                          {hw.doneTasks} / {hw.totalTasks} зад.
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                        {hw.topicTitle}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {cleanSectionName(hw.topicSection)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-indigo-700 tabular-nums">
                        Баллы: {hw.earnedPoints} / {hw.maxPoints}
                      </span>
                      <Link
                        href={`/courses/${hw.courseSlug}?topic=${hw.topicId}&tab=homework`}
                        prefetch={false}
                        className={`btn-tactile px-4 py-2 rounded-xl text-xs font-extrabold ${
                          allDone
                            ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                            : 'bg-amber-500 hover:bg-amber-600 border-amber-700 text-white'
                        }`}
                      >
                        {allDone ? 'Посмотреть →' : 'Решать ДЗ →'}
                      </Link>
                    </div>
                  </div>
                );
              })}

              {recentGraded.map((g) => (
                <Link
                  key={g.id}
                  href={`/courses/${g.courseSlug}?topic=${g.topicId}&tab=homework`}
                  prefetch={false}
                  className="rounded-3xl bg-white border border-emerald-200 hover:border-emerald-400 p-5 flex flex-col justify-between gap-3 transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                        ✓ Проверено учителем
                      </span>
                      <span className="text-sm font-extrabold text-emerald-700 tabular-nums">
                        {g.score} / {g.maxPoints} б.
                      </span>
                    </div>
                    <div className="text-sm font-extrabold text-slate-900">
                      {g.topicTitle}
                    </div>
                    {g.teacherComment && (
                      <p className="text-xs text-slate-600 bg-emerald-50/70 px-3 py-2 rounded-xl">
                        «{g.teacherComment}»
                      </p>
                    )}
                  </div>
                  <div className="text-xs font-bold text-emerald-700">
                    Открыть работу →
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* НА ЗАВТРА И БЛИЖАЙШИЕ УРОКИ */}
        {(tomorrowLessons.length > 0 || upcomingLessons.length > 0) && (
          <section className="space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-sky-700 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
              На завтра и скоро
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {tomorrowLessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={`/courses/${lesson.courseSlug}?topic=${lesson.topicId}`}
                  prefetch={false}
                  className="group bg-sky-50/60 hover:bg-sky-50 rounded-3xl border-2 border-sky-200 hover:border-sky-400 p-5 flex flex-col justify-between gap-3 transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-sky-600 text-white text-[11px] font-extrabold">
                        Завтра · {formatShortRuDate(lesson.lessonDate)}
                      </span>
                      {lesson.isAssessment && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                          🏆 СОР / СОЧ
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 group-hover:text-sky-800 transition">
                      {lesson.topicTitle}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {cleanSectionName(lesson.topicSection)}
                    </p>
                  </div>
                  <div className="text-xs font-bold text-sky-700">
                    Подготовиться заранее →
                  </div>
                </Link>
              ))}

              {upcomingLessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={`/courses/${lesson.courseSlug}?topic=${lesson.topicId}`}
                  prefetch={false}
                  className="group bg-white rounded-3xl border border-slate-200 hover:border-sky-300 p-5 flex flex-col justify-between gap-3 transition"
                >
                  <div className="space-y-1.5">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                      📅 {formatShortRuDate(lesson.lessonDate)}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 group-hover:text-indigo-700 transition">
                      {lesson.topicTitle}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {cleanSectionName(lesson.topicSection)}
                    </p>
                  </div>
                  <div className="text-xs font-bold text-indigo-600">
                    Открыть тему →
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* БЫСТРЫЙ ВХОД В ТРЕНАЖЁРЫ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
              Потренироваться прямо сейчас
            </h2>
            <Link
              href="/simulators"
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              Все 8 тренажёров →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_SIMS.map((sim) => (
              <Link
                key={sim.id}
                href={`/simulators?sim=${sim.id}`}
                className="group bg-white rounded-2xl border border-slate-200 hover:border-indigo-400 p-4 shadow-xs hover:shadow-sm transition flex flex-col gap-2"
              >
                <span className="text-2xl">{sim.icon}</span>
                <div>
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-indigo-700">
                    {sim.name}
                  </div>
                  <div className="text-[11px] text-slate-500">{sim.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}