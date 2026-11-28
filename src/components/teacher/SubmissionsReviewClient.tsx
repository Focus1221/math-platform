'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import MathMarkdown from '@/components/lesson/MathMarkdown';
import { playSound } from '@/lib/audio/sound';

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

interface AiReviewDraft {
  transcribed_solution: string;
  verdict: 'correct' | 'partial' | 'incorrect' | 'unreadable';
  suggested_score: number;
  error_step: string;
  teacher_comment: string;
}

const VERDICT_META: Record<
  AiReviewDraft['verdict'],
  { label: string; cls: string }
> = {
  correct: {
    label: '✅ Решение верное',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  partial: {
    label: '🟡 Частично верно',
    cls: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  incorrect: {
    label: '❌ Есть ошибка',
    cls: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  unreadable: {
    label: '📷 Фото нечитаемо',
    cls: 'bg-slate-100 text-slate-700 border-slate-300',
  },
};

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

  // Состояние ИИ-помощника проверки фото/текста
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [aiReviews, setAiReviews] = useState<Record<string, AiReviewDraft>>({});
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({});

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

  async function handleAiReview(item: ReviewSubmissionItem) {
    setAiLoadingId(item.id);
    setAiErrors((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });

    try {
      const res = await fetch('/api/teacher/ai-review-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: item.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAiErrors((prev) => ({
          ...prev,
          [item.id]: data.error || 'Не удалось выполнить ИИ-анализ работы.',
        }));
        return;
      }

      const review = data.review as AiReviewDraft;
      playSound('success');
      setAiReviews((prev) => ({ ...prev, [item.id]: review }));
    } catch {
      setAiErrors((prev) => ({
        ...prev,
        [item.id]: 'Сетевая ошибка при обращении к ИИ.',
      }));
    } finally {
      setAiLoadingId(null);
    }
  }

  function applyAiDraft(item: ReviewSubmissionItem, review: AiReviewDraft) {
    playSound('click');
    const clampedScore = Math.max(
      0,
      Math.min(item.maxPoints, Math.round(review.suggested_score))
    );
    setScoreDrafts((prev) => ({ ...prev, [item.id]: clampedScore }));
    setCommentDrafts((prev) => ({ ...prev, [item.id]: review.teacher_comment }));
  }

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

      playSound('success');
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
              const aiLoading = aiLoadingId === item.id;
              const aiReview = aiReviews[item.id];
              const aiError = aiErrors[item.id];
              const verdictInfo = aiReview ? VERDICT_META[aiReview.verdict] : null;
              const canAnalyze = Boolean(item.photoUrl || item.answerText.trim());

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

                    <div className="flex items-center gap-2">
                      {canAnalyze && (
                        <button
                          type="button"
                          disabled={aiLoading}
                          onClick={() => handleAiReview(item)}
                          className="px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-800 disabled:opacity-60 text-xs font-extrabold transition flex items-center gap-1.5"
                        >
                          {aiLoading ? (
                            <>
                              <span className="inline-block w-3.5 h-3.5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                              <span>Анализирую...</span>
                            </>
                          ) : (
                            <>
                              <span>✨</span>
                              <span>
                                {item.photoUrl
                                  ? 'Распознать фото с ИИ'
                                  : 'Проверить с ИИ'}
                              </span>
                            </>
                          )}
                        </button>
                      )}

                      <span className="text-[11px] text-slate-400">
                        {new Date(item.updatedAt).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
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

                  {/* Ошибка ИИ-проверки */}
                  {aiError && (
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                      {aiError}
                    </div>
                  )}

                  {/* Черновик проверки от ИИ */}
                  {aiReview && verdictInfo && (
                    <div className="p-4 rounded-2xl bg-violet-50 border-2 border-violet-200 space-y-3 animate-pop">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-extrabold text-violet-900">
                            ✨ Черновик проверки ИИ
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-lg border text-[11px] font-extrabold ${verdictInfo.cls}`}
                          >
                            {verdictInfo.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-white border border-violet-200 text-xs font-extrabold text-indigo-700 tabular-nums">
                            Рекомендуется: {aiReview.suggested_score} / {item.maxPoints} б.
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => applyAiDraft(item, aiReview)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition"
                          >
                            📥 Подставить балл и комментарий
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAiReviews((prev) => {
                                const next = { ...prev };
                                delete next[item.id];
                                return next;
                              })
                            }
                            className="w-7 h-7 rounded-lg bg-white border border-violet-200 text-slate-500 hover:text-rose-600 text-xs font-bold"
                            title="Скрыть черновик"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {aiReview.transcribed_solution && (
                        <div className="p-3 rounded-xl bg-white border border-violet-200/70 space-y-1">
                          <div className="text-[10px] font-extrabold uppercase text-slate-400">
                            Расшифровка решения
                          </div>
                          <div className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap">
                            <MathMarkdown content={aiReview.transcribed_solution} />
                          </div>
                        </div>
                      )}

                      {aiReview.error_step && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                          <strong>⚠️ Где найдена ошибка:</strong> {aiReview.error_step}
                        </div>
                      )}

                      {aiReview.teacher_comment && (
                        <div className="text-xs text-slate-700">
                          <strong className="text-violet-900">Предложенный комментарий:</strong>{' '}
                          {aiReview.teacher_comment}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Выставление оценки */}
                  <div className="pt-3 border-t border-slate-100 space-y-2.5">
                    {item.maxPoints <= 6 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-500 mr-1">
                          Быстрый балл:
                        </span>
                        {Array.from({ length: item.maxPoints + 1 }, (_, n) => {
                          const selected = (scoreDrafts[item.id] ?? 0) === n;
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                playSound('click');
                                setScoreDrafts((prev) => ({ ...prev, [item.id]: n }));
                              }}
                              className={`w-8 h-8 rounded-lg text-xs font-extrabold border transition ${
                                selected
                                  ? 'bg-indigo-600 text-white border-indigo-700'
                                  : 'bg-slate-50 hover:bg-indigo-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
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
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}