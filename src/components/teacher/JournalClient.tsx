'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export interface ClassroomRow {
  id: string;
  name: string;
  join_code: string;
  grade_number: number;
}

export interface StudentRow {
  id: string;
  full_name: string;
  email: string;
  classroom_id: string | null;
  login_username?: string | null;
  pin_code?: string | null;
}

export interface JournalCourse {
  id: string;
  title: string;
  grade_number: number;
}

export interface JournalTopic {
  id: string;
  course_id: string;
  order_index: number;
  quarter: number;
  title: string;
  is_assessment: boolean;
  maxPoints: number;
}

export interface ProgressEntry {
  student_id: string;
  topic_id: string;
  completed: boolean;
  sim_correct_count: number;
}

export interface TopicScoreEntry {
  student_id: string;
  topic_id: string;
  score: number;
}

interface TopicHeatStats {
  topic: JournalTopic;
  submittedCount: number;
  completedCount: number;
  avgPct: number | null;
  lowStudents: { id: string; name: string; score: number }[];
  level: 'none' | 'good' | 'warn' | 'gap';
}

interface Props {
  initialClassrooms: ClassroomRow[];
  initialStudents: StudentRow[];
  courses: JournalCourse[];
  topics: JournalTopic[];
  progressList: ProgressEntry[];
  topicScores: TopicScoreEntry[];
}

function getScoreBadgeClasses(score: number, maxPoints: number, heatmapOn: boolean): string {
  if (!heatmapOn || maxPoints <= 0) {
    return 'bg-indigo-100 text-indigo-800';
  }
  const pct = (score / maxPoints) * 100;
  if (pct >= 80) return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
  if (pct >= 50) return 'bg-amber-100 text-amber-800 border border-amber-300';
  return 'bg-rose-100 text-rose-800 border border-rose-300';
}

export default function JournalClient({
  initialClassrooms,
  initialStudents,
  courses,
  topics,
  progressList,
  topicScores,
}: Props) {
  const [tab, setTab] = useState<'matrix' | 'classes'>('matrix');
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(initialClassrooms);
  const [students, setStudents] = useState<StudentRow[]>(initialStudents);

  // Фильтры матрицы и тепловой карты
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [heatmapOn, setHeatmapOn] = useState<boolean>(true);
  const [focusedTopicId, setFocusedTopicId] = useState<string | null>(null);

  // Форма создания класса
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState(5);
  const [newClassCode, setNewClassCode] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);

  // Массовое добавление учеников (логин + PIN)
  const [bulkClassId, setBulkClassId] = useState<string>(initialClassrooms[0]?.id || '');
  const [bulkNamesText, setBulkNamesText] = useState('');
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkNotice, setBulkNotice] = useState('');

  // Уведомление о сброшенном пароле / PIN
  const [resetResult, setResetResult] = useState<{
    name: string;
    subtitle: string;
    password: string;
    isPin: boolean;
  } | null>(null);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);

  const activeBulkClassId = useMemo(() => {
    if (bulkClassId && classrooms.some((c) => c.id === bulkClassId)) {
      return bulkClassId;
    }
    return classrooms[0]?.id || '';
  }, [bulkClassId, classrooms]);

  // Быстрые словари для мгновенного рендера таблицы
  const progressMap = useMemo(() => {
    const map = new Map<string, ProgressEntry>();
    for (const p of progressList) {
      map.set(`${p.student_id}:${p.topic_id}`, p);
    }
    return map;
  }, [progressList]);

  const { scoreMap, submittedSet } = useMemo(() => {
    const scores = new Map<string, number>();
    const submitted = new Set<string>();
    for (const s of topicScores) {
      const k = `${s.student_id}:${s.topic_id}`;
      submitted.add(k);
      scores.set(k, (scores.get(k) || 0) + s.score);
    }
    return { scoreMap: scores, submittedSet: submitted };
  }, [topicScores]);

  const classMap = useMemo(
    () => new Map(classrooms.map((c) => [c.id, c])),
    [classrooms]
  );

  const visibleTopics = useMemo(
    () =>
      topics
        .filter((t) => t.course_id === selectedCourseId && t.quarter === selectedQuarter)
        .sort((a, b) => a.order_index - b.order_index),
    [topics, selectedCourseId, selectedQuarter]
  );

  const visibleStudents = useMemo(() => {
    return students
      .filter((s) => {
        if (selectedClassId === 'all') return true;
        if (selectedClassId === 'unassigned') return !s.classroom_id;
        return s.classroom_id === selectedClassId;
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'));
  }, [students, selectedClassId]);

  // Аналитика пробелов по каждой теме текущей четверти и выборки учеников
  const topicHeatMap = useMemo(() => {
    const statsMap = new Map<string, TopicHeatStats>();

    for (const topic of visibleTopics) {
      let submittedCount = 0;
      let completedCount = 0;
      let scoreSum = 0;
      const lowStudents: { id: string; name: string; score: number }[] = [];

      for (const st of visibleStudents) {
        const key = `${st.id}:${topic.id}`;
        const p = progressMap.get(key);
        if (p?.completed) completedCount++;

        if (topic.maxPoints > 0 && submittedSet.has(key)) {
          const sc = scoreMap.get(key) || 0;
          submittedCount++;
          scoreSum += sc;
          if ((sc / topic.maxPoints) * 100 < 60) {
            lowStudents.push({ id: st.id, name: st.full_name, score: sc });
          }
        }
      }

      let avgPct: number | null = null;
      let level: TopicHeatStats['level'] = 'none';

      if (topic.maxPoints > 0 && submittedCount > 0) {
        avgPct = Math.round((scoreSum / (submittedCount * topic.maxPoints)) * 100);
        const lowShare = lowStudents.length / submittedCount;
        if (avgPct < 55 || lowShare >= 0.5) {
          level = 'gap';
        } else if (avgPct < 75 || lowShare >= 0.3) {
          level = 'warn';
        } else {
          level = 'good';
        }
      }

      statsMap.set(topic.id, {
        topic,
        submittedCount,
        completedCount,
        avgPct,
        lowStudents,
        level,
      });
    }

    return statsMap;
  }, [visibleTopics, visibleStudents, progressMap, scoreMap, submittedSet]);

  const gapTopics = useMemo(() => {
    return Array.from(topicHeatMap.values())
      .filter((item) => item.level === 'gap' || item.level === 'warn')
      .sort((a, b) => (a.avgPct ?? 100) - (b.avgPct ?? 100));
  }, [topicHeatMap]);

  const focusedStats = focusedTopicId ? topicHeatMap.get(focusedTopicId) || null : null;

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setCreatingClass(true);
    try {
      const res = await fetch('/api/teacher/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClassName.trim(),
          gradeNumber: newClassGrade,
          joinCode: newClassCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Не удалось создать класс');
        return;
      }
      const created = data.classroom as ClassroomRow;
      setClassrooms((prev) => [...prev, created]);
      if (!bulkClassId) setBulkClassId(created.id);
      setNewClassName('');
      setNewClassCode('');
    } finally {
      setCreatingClass(false);
    }
  }

  async function handleDeleteClass(cls: ClassroomRow) {
    if (
      !confirm(
        `Удалить класс ${cls.name}? Ученики не удалятся, но перейдут в «Без класса».`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/teacher/classes?id=${cls.id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setClassrooms((prev) => prev.filter((c) => c.id !== cls.id));
      setStudents((prev) =>
        prev.map((s) => (s.classroom_id === cls.id ? { ...s, classroom_id: null } : s))
      );
      if (selectedClassId === cls.id) setSelectedClassId('all');
    }
  }

  async function handleBulkAddStudents(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBulkClassId || !bulkNamesText.trim()) return;
    setBulkCreating(true);
    setBulkNotice('');
    try {
      const res = await fetch('/api/teacher/bulk-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomId: activeBulkClassId,
          namesText: bulkNamesText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Не удалось добавить учеников');
        return;
      }
      const added = (data.created || []) as StudentRow[];
      if (added.length > 0) {
        setStudents((prev) => [...prev, ...added]);
        setBulkNamesText('');
        setBulkNotice(
          `Создано учеников: ${added.length}. Теперь можно сразу нажать «🖨️ Карточки A4» у выбранного класса!`
        );
      }
      if (Array.isArray(data.failed) && data.failed.length > 0) {
        alert(
          `Не удалось создать (${data.failed.length}): ` +
            data.failed
              .map((f: { name: string; reason: string }) => `${f.name} (${f.reason})`)
              .join(', ')
        );
      }
    } finally {
      setBulkCreating(false);
    }
  }

  async function handleAssignClass(studentId: string, classroomId: string) {
    setBusyStudentId(studentId);
    try {
      const nextId = classroomId || null;
      const res = await fetch('/api/teacher/classes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, classroomId: nextId }),
      });
      if (res.ok) {
        setStudents((prev) =>
          prev.map((s) => (s.id === studentId ? { ...s, classroom_id: nextId } : s))
        );
      }
    } finally {
      setBusyStudentId(null);
    }
  }

  async function handleResetPassword(student: StudentRow) {
    const label = student.login_username ? 'PIN-код' : 'пароль';
    if (!confirm(`Сбросить ${label} ученику ${student.full_name}?`)) return;
    setBusyStudentId(student.id);
    try {
      const res = await fetch('/api/teacher/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Ошибка сброса пароля');
        return;
      }

      const isPin = Boolean(data.isPin);
      if (isPin) {
        setStudents((prev) =>
          prev.map((s) =>
            s.id === student.id ? { ...s, pin_code: data.tempPassword } : s
          )
        );
      }

      setResetResult({
        name: student.full_name,
        subtitle: isPin
          ? `логин: ${data.loginUsername || student.login_username}`
          : student.email,
        password: data.tempPassword,
        isPin,
      });
    } finally {
      setBusyStudentId(null);
    }
  }

  async function handleRenameStudent(student: StudentRow) {
    const nextName = prompt('Новое имя и фамилия ученика:', student.full_name);
    if (!nextName || !nextName.trim() || nextName.trim() === student.full_name) {
      return;
    }

    setBusyStudentId(student.id);
    try {
      const res = await fetch('/api/teacher/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, fullName: nextName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Не удалось переименовать ученика');
        return;
      }
      setStudents((prev) =>
        prev.map((s) =>
          s.id === student.id ? { ...s, full_name: data.fullName } : s
        )
      );
    } finally {
      setBusyStudentId(null);
    }
  }

  async function handleDeleteStudent(student: StudentRow) {
    if (
      !confirm(
        `Удалить аккаунт ученика «${student.full_name}» вместе со всеми его баллами и работами?`
      )
    ) {
      return;
    }

    setBusyStudentId(student.id);
    try {
      const res = await fetch(`/api/teacher/students?id=${student.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Не удалось удалить ученика');
        return;
      }
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
    } finally {
      setBusyStudentId(null);
    }
  }

  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const headers = [
      'Ученик',
      'Класс',
      'Пройдено тем',
      'Баллы ДЗ',
      'Решено в тренажёрах',
      ...visibleTopics.map((t) => `№${t.order_index} ${t.title}`),
    ];

    const rows = visibleStudents.map((st) => {
      let doneCount = 0;
      let totalScore = 0;
      let totalSim = 0;

      const cells = visibleTopics.map((t) => {
        const key = `${st.id}:${t.id}`;
        const p = progressMap.get(key);
        const sc = scoreMap.get(key) || 0;
        const hasSub = submittedSet.has(key);
        if (p?.completed) doneCount++;
        totalScore += sc;
        totalSim += p?.sim_correct_count || 0;

        if (t.maxPoints > 0 && hasSub) return `${sc}/${t.maxPoints}`;
        if (p?.completed) return '✓';
        return '';
      });

      const clsName = st.classroom_id
        ? classMap.get(st.classroom_id)?.name || ''
        : 'Без класса';
      return [st.full_name, clsName, doneCount, totalScore, totalSim, ...cells]
        .map(esc)
        .join(';');
    });

    const csv = '\uFEFF' + [headers.map(esc).join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-q${selectedQuarter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900">
              📊 Классы и журнал успеваемости
            </h1>
            <p className="text-xs text-slate-500">
              Классов: <strong>{classrooms.length}</strong> · Учеников:{' '}
              <strong>{students.length}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/teacher/submissions"
              className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition"
            >
              📥 Проверка ДЗ
            </Link>
            <Link
              href="/today"
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
            >
              ← Сегодня
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-6 space-y-5">
        {/* Переключатель разделов */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setTab('matrix')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                tab === 'matrix' ? 'bg-indigo-600 text-white' : 'text-slate-600'
              }`}
            >
              📊 Сводный журнал
            </button>
            <button
              type="button"
              onClick={() => setTab('classes')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                tab === 'classes' ? 'bg-indigo-600 text-white' : 'text-slate-600'
              }`}
            >
              🏫 Классы и ученики ({students.length})
            </button>
          </div>

          {tab === 'matrix' && (
            <button
              type="button"
              onClick={exportCsv}
              className="btn-tactile px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 border-emerald-800 text-white text-xs font-bold shadow-xs transition"
            >
              ⬇ Скачать таблицу (Excel / CSV)
            </button>
          )}
        </div>

        {/* Баннер с новым паролем или PIN */}
        {resetResult && (
          <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 flex flex-wrap items-center justify-between gap-3 animate-pop">
            <div className="text-xs sm:text-sm text-emerald-950 space-y-0.5">
              <div className="font-extrabold">
                🔑 {resetResult.isPin ? 'PIN-код обновлён' : 'Пароль обновлён'} для:{' '}
                {resetResult.name} ({resetResult.subtitle})
              </div>
              <div>
                {resetResult.isPin ? 'Новый PIN-код:' : 'Временный пароль:'}{' '}
                <code className="px-2 py-0.5 rounded-lg bg-white border border-emerald-300 font-mono text-base font-extrabold text-emerald-800">
                  {resetResult.password}
                </code>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(resetResult.password)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
              >
                📋 Копировать
              </button>
              <button
                type="button"
                onClick={() => setResetResult(null)}
                className="px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-xs font-bold text-slate-600"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}

        {/* ВКЛАДКА 1: Сводная матрица + Тепловая карта пробелов */}
        {tab === 'matrix' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setFocusedTopicId(null);
                  }}
                  className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="all">Все классы ({students.length})</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      Класс {c.name} ({c.join_code})
                    </option>
                  ))}
                  <option value="unassigned">Без класса</option>
                </select>

                <select
                  value={selectedCourseId}
                  onChange={(e) => {
                    setSelectedCourseId(e.target.value);
                    setFocusedTopicId(null);
                  }}
                  className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>

                <div className="inline-flex p-1 bg-slate-100 rounded-xl">
                  {[1, 2, 3, 4].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setSelectedQuarter(q);
                        setFocusedTopicId(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        selectedQuarter === q
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {q} четверть
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {heatmapOn && (
                  <div className="hidden xl:flex items-center gap-2 text-[11px] font-bold text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
                      ≥80%
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                      50–79%
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" />
                      &lt;50% пробел
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setHeatmapOn((v) => !v);
                    setFocusedTopicId(null);
                  }}
                  className={`px-3 py-2 rounded-xl border text-xs font-extrabold transition ${
                    heatmapOn
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300'
                  }`}
                >
                  {heatmapOn ? '🔥 Тепловая карта: ВКЛ' : '🔥 Тепловая карта: ВЫКЛ'}
                </button>
              </div>
            </div>

            {/* Сводка проблемных тем для повторения перед СОР */}
            {heatmapOn && visibleStudents.length > 0 && gapTopics.length > 0 && (
              <div className="bg-white rounded-3xl border-2 border-amber-200 p-4 sm:p-5 space-y-3 animate-pop">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xs sm:text-sm font-extrabold text-slate-900">
                      🎯 Темы с пробелами — стоит повторить перед СОР ({gapTopics.length})
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Нажми на тему, чтобы подсветить столбец в журнале и увидеть список учеников ниже 60%.
                    </p>
                  </div>
                  {focusedTopicId && (
                    <button
                      type="button"
                      onClick={() => setFocusedTopicId(null)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-600"
                    >
                      Снять выделение
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {gapTopics.map((item) => {
                    const isFocused = focusedTopicId === item.topic.id;
                    const isCritical = item.level === 'gap';
                    return (
                      <button
                        key={item.topic.id}
                        type="button"
                        onClick={() =>
                          setFocusedTopicId((prev) =>
                            prev === item.topic.id ? null : item.topic.id
                          )
                        }
                        className={`text-left px-3 py-2 rounded-xl border text-xs transition flex items-center gap-2 ${
                          isFocused
                            ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50'
                            : isCritical
                              ? 'bg-rose-50 border-rose-200 hover:border-rose-300 text-rose-900'
                              : 'bg-amber-50 border-amber-200 hover:border-amber-300 text-amber-900'
                        }`}
                      >
                        <span className="font-extrabold">№{item.topic.order_index}</span>
                        <span className="font-bold max-w-[200px] truncate">
                          {item.topic.title}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${
                            isCritical
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          ср. {item.avgPct}%
                        </span>
                      </button>
                    );
                  })}
                </div>

                {focusedStats && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                    <div className="font-extrabold text-slate-900">
                      Урок №{focusedStats.topic.order_index}. {focusedStats.topic.title} — средний результат{' '}
                      <span className="text-rose-700">{focusedStats.avgPct}%</span> (сдали{' '}
                      {focusedStats.submittedCount} из {visibleStudents.length} уч.)
                    </div>
                    {focusedStats.lowStudents.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-500 font-semibold">Нужна помощь:</span>
                        {focusedStats.lowStudents.map((ls) => (
                          <span
                            key={ls.id}
                            className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-bold"
                          >
                            {ls.name} ({ls.score}/{focusedStats.topic.maxPoints})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-500">
                        У сдавших учеников нет критических провалов, но средний балл ниже 75%.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {visibleStudents.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center text-sm text-slate-500">
                В выбранном классе пока нет учеников. Перейди во вкладку «Классы и
                ученики», чтобы создать класс и добавить детей списком.
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="sticky left-0 z-20 bg-slate-50 px-4 py-3 font-extrabold text-slate-800 min-w-[200px] border-r border-slate-200">
                        Ученик
                      </th>
                      <th className="px-3 py-3 font-bold text-slate-600 text-center whitespace-nowrap">
                        Темы
                      </th>
                      <th className="px-3 py-3 font-bold text-slate-600 text-center whitespace-nowrap">
                        ДЗ (б.)
                      </th>
                      <th className="px-3 py-3 font-bold text-slate-600 text-center whitespace-nowrap border-r border-slate-200">
                        🏆 Симул.
                      </th>
                      {visibleTopics.map((t) => {
                        const st = topicHeatMap.get(t.id);
                        const isFocused = focusedTopicId === t.id;
                        let headCls = t.is_assessment
                          ? 'bg-amber-50 text-amber-800'
                          : 'text-slate-600';
                        if (isFocused) {
                          headCls = 'bg-indigo-100 text-indigo-900';
                        } else if (heatmapOn && st?.level === 'gap') {
                          headCls = 'bg-rose-50 text-rose-800';
                        }

                        return (
                          <th
                            key={t.id}
                            onClick={() =>
                              setFocusedTopicId((prev) => (prev === t.id ? null : t.id))
                            }
                            title={`${t.order_index}. ${t.title}${
                              st?.avgPct !== null && st?.avgPct !== undefined
                                ? ` · Ср. балл: ${st.avgPct}%`
                                : ''
                            }`}
                            className={`px-2 py-3 text-center font-bold min-w-[56px] cursor-pointer transition ${headCls}`}
                          >
                            <div>№{t.order_index}</div>
                            {t.is_assessment && (
                              <div className="text-[9px] font-extrabold text-amber-700">
                                СОР
                              </div>
                            )}
                            {heatmapOn && st?.level === 'gap' && !t.is_assessment && (
                              <div className="text-[9px] font-extrabold text-rose-600">
                                пробел
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleStudents.map((st) => {
                      let doneCount = 0;
                      let totalScore = 0;
                      let totalSim = 0;

                      const topicCells = visibleTopics.map((t) => {
                        const key = `${st.id}:${t.id}`;
                        const p = progressMap.get(key);
                        const sc = scoreMap.get(key) || 0;
                        const hasSub = submittedSet.has(key);
                        if (p?.completed) doneCount++;
                        totalScore += sc;
                        totalSim += p?.sim_correct_count || 0;
                        return { t, p, sc, hasSub };
                      });

                      const clsName = st.classroom_id
                        ? classMap.get(st.classroom_id)?.name
                        : null;

                      return (
                        <tr key={st.id} className="hover:bg-indigo-50/30 transition">
                          <td className="sticky left-0 z-10 bg-white px-4 py-2.5 border-r border-slate-200">
                            <div className="font-bold text-slate-900">
                              {st.full_name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {clsName ? `Класс ${clsName}` : 'Без класса'}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-700 tabular-nums">
                            {doneCount}/{visibleTopics.length}
                          </td>
                          <td className="px-3 py-2.5 text-center font-extrabold text-indigo-700 tabular-nums">
                            {totalScore}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-emerald-700 border-r border-slate-200 tabular-nums">
                            {totalSim}
                          </td>
                          {topicCells.map(({ t, p, sc, hasSub }) => {
                            const isFocused = focusedTopicId === t.id;
                            const showScore = t.maxPoints > 0 && (hasSub || sc > 0);
                            return (
                              <td
                                key={t.id}
                                title={`${t.title} — ${
                                  p?.completed ? 'Пройдена' : 'Не отмечена'
                                }${
                                  showScore
                                    ? `, ДЗ: ${sc}/${t.maxPoints} (${Math.round(
                                        (sc / t.maxPoints) * 100
                                      )}%)`
                                    : ''
                                }${
                                  p?.sim_correct_count
                                    ? `, тренажёр: ${p.sim_correct_count}`
                                    : ''
                                }`}
                                className={`px-1.5 py-2.5 text-center ${
                                  isFocused ? 'bg-indigo-50/50' : ''
                                }`}
                              >
                                {showScore ? (
                                  <span
                                    className={`inline-block px-1.5 py-0.5 rounded-md font-bold text-[11px] tabular-nums ${getScoreBadgeClasses(
                                      sc,
                                      t.maxPoints,
                                      heatmapOn
                                    )}`}
                                  >
                                    {sc}/{t.maxPoints}
                                  </span>
                                ) : p?.completed ? (
                                  <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold">
                                    ✓
                                  </span>
                                ) : (
                                  <span className="text-slate-300">·</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Итоговая полоса тепловой карты по классу */}
                  {heatmapOn && (
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 font-extrabold text-slate-700 border-r border-slate-200">
                          🔥 Ср. усвоение ДЗ
                        </td>
                        <td colSpan={3} className="px-3 py-2.5 text-center text-[11px] text-slate-500 border-r border-slate-200">
                          По сдавшим
                        </td>
                        {visibleTopics.map((t) => {
                          const st = topicHeatMap.get(t.id);
                          const isFocused = focusedTopicId === t.id;
                          if (!st || st.avgPct === null) {
                            return (
                              <td
                                key={t.id}
                                className={`px-1.5 py-2.5 text-center text-[11px] text-slate-400 ${
                                  isFocused ? 'bg-indigo-50/50' : ''
                                }`}
                              >
                                —
                              </td>
                            );
                          }
                          const pillCls =
                            st.level === 'good'
                              ? 'bg-emerald-100 text-emerald-800'
                              : st.level === 'warn'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800';
                          return (
                            <td
                              key={t.id}
                              onClick={() =>
                                setFocusedTopicId((prev) => (prev === t.id ? null : t.id))
                              }
                              title={`Сдали ${st.submittedCount} из ${visibleStudents.length} уч. · Средний балл: ${st.avgPct}%`}
                              className={`px-1 py-2.5 text-center cursor-pointer ${
                                isFocused ? 'bg-indigo-50/50' : ''
                              }`}
                            >
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${pillCls}`}
                              >
                                {st.avgPct}%
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА 2: Управление классами и учениками */}
        {tab === 'classes' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Левая колонка: классы */}
            <div className="space-y-4">
              <form
                onSubmit={handleCreateClass}
                className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3"
              >
                <h2 className="text-sm font-extrabold text-slate-900">
                  + Создать класс
                </h2>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Название (например: 5 «А»)"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newClassGrade}
                    onChange={(e) => setNewClassGrade(Number(e.target.value))}
                    className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {[5, 6, 7, 8, 9, 10, 11].map((g) => (
                      <option key={g} value={g}>
                        {g} класс
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newClassCode}
                    onChange={(e) => setNewClassCode(e.target.value.toUpperCase())}
                    placeholder="Код (напр. 5A-2026)"
                    className="px-3 py-2 text-xs uppercase bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Если поле кода оставить пустым, он сгенерируется автоматически.
                </p>
                <button
                  type="submit"
                  disabled={creatingClass}
                  className="btn-tactile w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 text-white text-xs font-bold transition"
                >
                  {creatingClass ? 'Создание...' : 'Создать класс'}
                </button>
              </form>

              <div className="space-y-2.5">
                {classrooms.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                    Создай первый класс — например, 5 «А» и 5 «Б».
                  </div>
                ) : (
                  classrooms.map((cls) => {
                    const count = students.filter(
                      (s) => s.classroom_id === cls.id
                    ).length;
                    return (
                      <div
                        key={cls.id}
                        className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start justify-between gap-2"
                      >
                        <div>
                          <div className="text-sm font-extrabold text-slate-900">
                            {cls.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Код:{' '}
                            <button
                              type="button"
                              onClick={() =>
                                navigator.clipboard.writeText(cls.join_code)
                              }
                              className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold hover:bg-indigo-100"
                              title="Нажми, чтобы скопировать код"
                            >
                              {cls.join_code} 📋
                            </button>{' '}
                            · {count} уч.
                          </div>
                          <div className="mt-2">
                            <Link
                              href={`/teacher/cards/${cls.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition"
                            >
                              🖨️ Карточки A4
                            </Link>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteClass(cls)}
                          className="text-xs font-bold text-slate-400 hover:text-rose-600"
                          title="Удалить класс"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Правая колонка: массовое добавление и список учеников */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-5 space-y-5">
              {classrooms.length > 0 && (
                <form
                  onSubmit={handleBulkAddStudents}
                  className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-indigo-950">
                        📋 Добавить учеников списком (вход по логину + PIN)
                      </h3>
                      <p className="text-[11px] text-slate-600">
                        Вставь список фамилий и имён (по одному на строку) — почта
                        детям не понадобится.
                      </p>
                    </div>
                    <select
                      value={activeBulkClassId}
                      onChange={(e) => setBulkClassId(e.target.value)}
                      className="px-3 py-1.5 text-xs font-bold bg-white border border-indigo-200 rounded-xl"
                    >
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.id}>
                          Класс {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    rows={4}
                    value={bulkNamesText}
                    onChange={(e) => setBulkNamesText(e.target.value)}
                    placeholder={'Серикбай Алия\nНурланов Арман\nАхметов Диас'}
                    className="w-full p-3 text-xs sm:text-sm bg-white border border-indigo-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />

                  {bulkNotice && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                      ✓ {bulkNotice}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/teacher/cards/${activeBulkClassId}`}
                      className="text-xs font-bold text-indigo-700 hover:underline"
                    >
                      🖨️ Открыть карточки для печати A4 →
                    </Link>
                    <button
                      type="submit"
                      disabled={bulkCreating}
                      className="btn-tactile px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 disabled:opacity-60 text-white text-xs font-extrabold"
                    >
                      {bulkCreating
                        ? 'Создаём аккаунты...'
                        : '+ Создать аккаунты и PIN-коды'}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                <h2 className="text-sm font-extrabold text-slate-900">
                  Список учеников ({students.length})
                </h2>

                {students.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Пока нет зарегистрированных учеников.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {students.map((st) => (
                      <div
                        key={st.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">
                            {st.full_name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                            {st.login_username ? (
                              <>
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono font-bold text-slate-700">
                                  {st.login_username}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 font-mono font-bold text-indigo-700">
                                  PIN: {st.pin_code}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-400 truncate">{st.email}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <select
                            disabled={busyStudentId === st.id}
                            value={st.classroom_id || ''}
                            onChange={(e) => handleAssignClass(st.id, e.target.value)}
                            className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl"
                          >
                            <option value="">Без класса</option>
                            {classrooms.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            disabled={busyStudentId === st.id}
                            onClick={() => handleResetPassword(st)}
                            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition whitespace-nowrap"
                          >
                            🔑 {st.login_username ? 'Новый PIN' : 'Сбросить пароль'}
                          </button>

                          <button
                            type="button"
                            disabled={busyStudentId === st.id}
                            onClick={() => handleRenameStudent(st)}
                            title="Переименовать ученика"
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 text-xs font-bold transition"
                          >
                            ✏️
                          </button>

                          <button
                            type="button"
                            disabled={busyStudentId === st.id}
                            onClick={() => handleDeleteStudent(st)}
                            title="Удалить аккаунт ученика"
                            className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}