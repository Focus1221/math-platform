'use client';

import { useState } from 'react';
import Link from 'next/link';
import MathMarkdown from '@/components/lesson/MathMarkdown';

export interface ReviewItem {
  id: string;
  studentName: string;
  courseTitle: string;
  topicTitle: string;
  questionMd: string;
  taskType: 'test' | 'input' | 'open';
  maxPoints: number;
  answerText: string;
  photoUrl: string | null;
  score: number;
  status: 'checked' | 'pending_review' | 'graded';
  teacherComment: string;
  updatedAt: string;
}

export default function SubmissionsReviewClient({
  initialItems,
}: {
  initialItems: ReviewItem[];
}) {
  const [items, setItems] = useState<ReviewItem[]>(initialItems);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialItems.map((i) => [i.id, i.score]))
  );
  const [comments, setComments] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialItems.map((i) => [i.id, i.teacherComment]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const visible = items.filter((item) =>
    filter === 'pending' ? item.status === 'pending_review' : true
  );

  const pendingCount = items.filter((i) => i.status === 'pending_review').length;

  async function saveGrade(item: ReviewItem) {
    setSavingId(item.id);
    try {
      const score = Math.min(item.maxPoints, Math.max(0, Number(scores[item.id] ?? 0)));
      const teacherComment = comments[item.id] || '';
      const res = await fetch('/api/teacher/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: item.id, score, teacherComment }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Ошибка сохранения');
        return;
      }

      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? { ...row, score, teacherComment, status: 'graded' }
            : row
        )
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900">
              📥 Журнал проверки домашних заданий
            </h1>
            <p className="text-xs text-slate-500">
              Ожидают проверки: <strong>{pendingCount}</strong> · Всего сдач: {items.length}
            </p>
          </div>
          <Link
            href="/courses"
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
          >
            ← К курсам
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              filter === 'pending' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            На проверке ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            Все ответы ({items.length})
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-2">
            <div className="text-3xl">✅</div>
            <p className="text-sm font-bold text-slate-700">
              {filter === 'pending'
                ? 'Все открытые задания проверены!'
                : 'Ученики пока не отправляли домашние задания.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">
                      🎓 {item.studentName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.courseTitle} · {item.topicTitle}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      item.status === 'pending_review'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {item.status === 'pending_review'
                      ? '⏳ Ждёт проверки'
                      : `✓ ${item.score} / ${item.maxPoints} б.`}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Условие задачи ({item.maxPoints} б.)
                  </div>
                  <MathMarkdown content={item.questionMd} />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700">Ответ ученика:</div>
                  {item.answerText && (
                    <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-sm text-slate-800 whitespace-pre-wrap">
                      {item.answerText}
                    </div>
                  )}
                  {item.photoUrl && (
                    <a href={item.photoUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                      <img
                        src={item.photoUrl}
                        alt="Фото тетради ученика"
                        className="max-h-72 rounded-2xl border border-slate-200 shadow-xs hover:opacity-95 transition"
                      />
                    </a>
                  )}
                </div>

                {/* Панель оценивания */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-xs font-bold text-slate-600">Балл:</label>
                    <input
                      type="number"
                      min={0}
                      max={item.maxPoints}
                      value={scores[item.id] ?? 0}
                      onChange={(e) =>
                        setScores((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))
                      }
                      className="w-20 px-3 py-2 text-sm font-bold text-center bg-slate-50 border border-slate-300 rounded-xl"
                    />
                    <span className="text-xs text-slate-400">/ {item.maxPoints}</span>
                  </div>

                  <input
                    type="text"
                    value={comments[item.id] ?? ''}
                    onChange={(e) =>
                      setComments((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="Комментарий ученику (например: Отличное решение!)"
                    className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl"
                  />

                  <button
                    type="button"
                    disabled={savingId === item.id}
                    onClick={() => saveGrade(item)}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold transition shrink-0"
                  >
                    {savingId === item.id ? 'Сохранение...' : 'Сохранить оценку'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}