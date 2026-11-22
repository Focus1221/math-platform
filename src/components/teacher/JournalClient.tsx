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

interface Props {
  initialClassrooms: ClassroomRow[];
  initialStudents: StudentRow[];
  courses: JournalCourse[];
  topics: JournalTopic[];
  progressList: ProgressEntry[];
  topicScores: TopicScoreEntry[];
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

  // Фильтры матрицы
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);

  // Форма создания класса
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState(5);
  const [newClassCode, setNewClassCode] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);

  // Уведомление о сброшенном пароле
  const [resetResult, setResetResult] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);

  // Быстрые словари для мгновенного рендера таблицы
  const progressMap = useMemo(() => {
    const map = new Map<string, ProgressEntry>();
    for (const p of progressList) {
      map.set(`${p.student_id}:${p.topic_id}`, p);
    }
    return map;
  }, [progressList]);

  const scoreMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of topicScores) {
      const k = `${s.student_id}:${s.topic_id}`;
      map.set(k, (map.get(k) || 0) + s.score);
    }
    return map;
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
      setClassrooms((prev) => [...prev, data.classroom as ClassroomRow]);
      setNewClassName('');
      setNewClassCode('');
    } finally {
      setCreatingClass(false);
    }
  }

  async function handleDeleteClass(cls: ClassroomRow) {
    if (!confirm(`Удалить класс ${cls.name}? Ученики не удалятся, но перейдут в «Без класса».`)) {
      return;
    }
    const res = await fetch(`/api/teacher/classes?id=${cls.id}`, { method: 'DELETE' });
    if (res.ok) {
      setClassrooms((prev) => prev.filter((c) => c.id !== cls.id));
      setStudents((prev) =>
        prev.map((s) => (s.classroom_id === cls.id ? { ...s, classroom_id: null } : s))
      );
      if (selectedClassId === cls.id) setSelectedClassId('all');
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
    if (!confirm(`Сбросить пароль ученику ${student.full_name}?`)) return;
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
      setResetResult({
        name: student.full_name,
        email: student.email,
        password: data.tempPassword,
      });
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
        if (p?.completed) doneCount++;
        totalScore += sc;
        totalSim += p?.sim_correct_count || 0;

        if (t.maxPoints > 0 && sc > 0) return `${sc}/${t.maxPoints}`;
        if (p?.completed) return '✓';
        return '';
      });

      const clsName = st.classroom_id ? classMap.get(st.classroom_id)?.name || '' : 'Без класса';
      return [st.full_name, clsName, doneCount, totalScore, totalSim, ...cells].map(esc).join(';');
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
    <div className="min-h-screen bg-[#F4F7FB]">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900">
              📊 Классы и журнал успеваемости
            </h1>
            <p className="text-xs text-slate-500">
              Классов: <strong>{classrooms.length}</strong> · Учеников: <strong>{students.length}</strong>
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
              href="/courses"
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
            >
              ← К курсам
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
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
            >
              ⬇ Скачать таблицу (Excel / CSV)
            </button>
          )}
        </div>

        {/* Баннер с новым паролем */}
        {resetResult && (
          <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-emerald-950 space-y-0.5">
              <div className="font-extrabold">
                🔑 Пароль обновлён для: {resetResult.name} ({resetResult.email})
              </div>
              <div>
                Временный пароль:{' '}
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

        {/* ВКЛАДКА 1: Сводная матрица */}
        {tab === 'matrix' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
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
                onChange={(e) => setSelectedCourseId(e.target.value)}
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
                    onClick={() => setSelectedQuarter(q)}
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

            {visibleStudents.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center text-sm text-slate-500">
                В выбранном классе пока нет учеников. Перейди во вкладку «Классы и ученики», чтобы создать класс и выдать код.
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
                      {visibleTopics.map((t) => (
                        <th
                          key={t.id}
                          title={`${t.order_index}. ${t.title}`}
                          className={`px-2 py-3 text-center font-bold min-w-[52px] cursor-help ${
                            t.is_assessment
                              ? 'bg-amber-50 text-amber-800'
                              : 'text-slate-600'
                          }`}
                        >
                          <div>№{t.order_index}</div>
                          {t.is_assessment && (
                            <div className="text-[9px] font-extrabold text-amber-700">СОР</div>
                          )}
                        </th>
                      ))}
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
                        if (p?.completed) doneCount++;
                        totalScore += sc;
                        totalSim += p?.sim_correct_count || 0;
                        return { t, p, sc };
                      });

                      const clsName = st.classroom_id
                        ? classMap.get(st.classroom_id)?.name
                        : null;

                      return (
                        <tr key={st.id} className="hover:bg-indigo-50/30 transition">
                          <td className="sticky left-0 z-10 bg-white px-4 py-2.5 border-r border-slate-200">
                            <div className="font-bold text-slate-900">{st.full_name}</div>
                            <div className="text-[10px] text-slate-400">
                              {clsName ? `Класс ${clsName}` : 'Без класса'}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                            {doneCount}/{visibleTopics.length}
                          </td>
                          <td className="px-3 py-2.5 text-center font-extrabold text-indigo-700">
                            {totalScore}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-emerald-700 border-r border-slate-200">
                            {totalSim}
                          </td>
                          {topicCells.map(({ t, p, sc }) => (
                            <td
                              key={t.id}
                              title={`${t.title} — ${p?.completed ? 'Пройдена' : 'Не отмечена'}${
                                t.maxPoints > 0 ? `, ДЗ: ${sc}/${t.maxPoints}` : ''
                              }`}
                              className="px-1.5 py-2.5 text-center"
                            >
                              {sc > 0 ? (
                                <span className="inline-block px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold text-[11px]">
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
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
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
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
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
                    const count = students.filter((s) => s.classroom_id === cls.id).length;
                    return (
                      <div
                        key={cls.id}
                        className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-sm font-extrabold text-slate-900">
                            {cls.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Код:{' '}
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(cls.join_code)}
                              className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold hover:bg-indigo-100"
                              title="Нажми, чтобы скопировать код"
                            >
                              {cls.join_code} 📋
                            </button>{' '}
                            · {count} уч.
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

            {/* Правая колонка: список учеников */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-5 space-y-4">
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
                        <div className="text-xs text-slate-400 truncate">{st.email}</div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
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
                          🔑 Сбросить пароль
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}