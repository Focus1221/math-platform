'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import MathMarkdown from '@/components/lesson/MathMarkdown';

export interface ReviewClassroom {
  id: string;
  name: string;
}

export interface ReviewSubmissionItem {
  id: string;
  studentId: string;
  studentName: string;
  classroomId: string | null;
  classroomName: string | null;
  topicTitle: string;
  topicOrder: number;
  questionMd: string;
  maxPoints: number;
  answerText: string;
  photoUrl: string | null;
  status: string;
  score: number;
  teacherComment: string;
  updatedAt: string;
}

interface Props {
  classrooms: ReviewClassroom[];
  initialItems: ReviewSubmissionItem[];
}

export default function SubmissionsReviewClient({
  classrooms,
  initialItems,
}: Props) {
  const [items, setItems] = useState<ReviewSubmissionItem[]>(initialItems);
  const [classFilter, setClassFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'graded' | 'all'>(
    'pending'
  );
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const it of initialItems) {
      map[it.id] = it.status === 'graded' ? it.score : it.maxPoints;
    }
    return map;
  });
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const it of initialItems) {
      map[it.id] = it.teacherComment || '';
    }
    return map;
  });
  const [savingId, setSavingId] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => items.filter((i) => i.status === 'pending_review').length,
    [items]
  );

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (classFilter === 'unassigned' && item.classroomId !== null) return false;
      if (
        classFilter !== 'all' &&
        classFilter !== 'unassigned' &&
        item.classroomId !== classFilter
      ) {
        return false;
      }

      if (statusFilter === 'pending' && item.status !== 'pending_review') return false;
      if (statusFilter === 'graded' && item.status !== 'graded') return false;
      return true;
    });
  }, [items, classFilter, statusFilter]);

  async function handleGrade(item: ReviewSubmissionItem) {
    setSavingId(item.id);
    const nextScore = Math.max(
      0,
      Math.min(item.maxPoints, Number(scoreDrafts[item.id] ?? 0))
    );
    const nextComment = commentDrafts[item.id] ?? '';

    try {
      const res = await fetch('/api/teacher/grade-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: item.id,
          score: nextScore,
          teacherComment: nextComment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Не удалось сохранить оценку');
        return;
      }

      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                status: 'graded',
                score: nextScore,
                teacherComment: nextComment,
              }
            : row
        )
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900">
              📥 Проверка домашних работ
            </h1>
            <p className="text-xs text-slate-500">
              Ждут проверки: <strong className="text-amber-700">{pendingCount}</strong> ·
              Всего развёрнутых: <strong>{items.length}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/teacher/journal"
              className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold transition"
            >
              📊 Журнал
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

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Фильтры по классу и статусу */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Класс:</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="all">Все классы</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  Класс {c.name}
                </option>
              ))}
              <option value="unassigned">Без класса</option>
            </select>
          </div>

          <div className="inline-flex p-1 bg-slate-100 rounded-xl">
            {(
              [
                ['pending', `⏳ Ждут (${pendingCount})`],
                ['graded', '✓ Проверенные'],
                ['all', 'Все'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStatusFilter(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Список работ */}
        {visibleItems.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-2">
            <div className="text-3xl">🎉</div>
            <p className="text-sm font-extrabold text-slate-800">
              {statusFilter === 'pending'
                ? 'Все работы в этом фильтре уже проверены!'
                : 'Работ по выбранному фильтру пока нет.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item) => {
              const isGraded = item.status === 'graded';
              const busy = savingId === item.id;
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-3xl border-2 p-5 space-y-4 shadow-xs ${
                    isGraded ? 'border-emerald-200' : 'border-amber-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900">
                          {item.studentName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold">
                          {item.classroomName || 'Без класса'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            isGraded
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isGraded
                            ? `✓ Оценено: ${item.score}/${item.maxPoints} б.`
                            : '⏳ Ждёт проверки'}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-500">
                        Урок №{item.topicOrder}. {item.topicTitle}
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-400">
                      {new Date(item.updatedAt).toLocaleString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Условие задачи */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Условие ({item.maxPoints} б.)
                    </div>
                    <MathMarkdown content={item.questionMd} />
                  </div>

                  {/* Ответ ученика */}
                  <div className="space-y-3">
                    {item.answerText && (
                      <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-sm text-slate-800 whitespace-pre-wrap">
                        <div className="text-[10px] font-bold uppercase text-indigo-500 mb-1">
                          Текст решения ученика
                        </div>
                        {item.answerText}
                      </div>
                    )}

                    {item.photoUrl && (
                      <div>
                        <div className="text-[11px] font-bold text-slate-500 mb-1.5">
                          📷 Фото тетради (нажми, чтобы открыть крупнее):
                        </div>
                        <a
                          href={item.photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block"
                        >
                          <img
                            src={item.photoUrl}
                            alt={`Решение ${item.studentName}`}
                            className="max-h-72 rounded-2xl border border-slate-200 shadow-xs hover:opacity-95 transition"
                          />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Выставление оценки */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                    <div className="w-full sm:w-32">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Баллы (из {item.maxPoints})
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={item.maxPoints}
                        value={scoreDrafts[item.id] ?? 0}
                        onChange={(e) =>
                          setScoreDrafts((prev) => ({
                            ...prev,
                            [item.id]: Number(e.target.value),
                          }))
                        }
                        className="w-full px-3 py-2 text-sm font-extrabold text-center bg-slate-50 border border-slate-300 rounded-xl"
                      />
                    </div>

                    <div className="flex-1">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Комментарий ученику (появится на экране «Сегодня»)
                      </label>
                      <input
                        type="text"
                        value={commentDrafts[item.id] ?? ''}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        placeholder="Например: Отлично, аккуратное решение!"
                        className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleGrade(item)}
                      className="btn-tactile px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 border-emerald-800 disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold shrink-0"
                    >
                      {busy
                        ? 'Сохраняем...'
                        : isGraded
                          ? 'Обновить оценку'
                          : '✓ Поставить балл'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}