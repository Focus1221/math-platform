'use client';

import { useState } from 'react';
import { getLocalDateISO } from '@/lib/format/cleanTopic';
import type { ClassScheduleItem, Topic } from '@/types/db';

interface ClassroomOption {
  id: string;
  name: string;
  join_code: string;
}

interface Props {
  topic: Topic;
  classrooms: ClassroomOption[];
  schedules: ClassScheduleItem[];
  onClose: () => void;
  onSaved: (item: ClassScheduleItem) => void;
  onDeleted: (classroomId: string, topicId: string) => void;
}

export default function ScheduleTopicModal({
  topic,
  classrooms,
  schedules,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const today = getLocalDateISO(0);
  const tomorrow = getLocalDateISO(1);
  const dayAfter = getLocalDateISO(2);

  const [classroomId, setClassroomId] = useState(classrooms[0]?.id || '');

  const existing = schedules.find(
    (s) => s.classroom_id === classroomId && s.topic_id === topic.id
  );

  const [lessonDate, setLessonDate] = useState(existing?.lesson_date || today);
  const [hwDueDate, setHwDueDate] = useState(existing?.hw_due_date || tomorrow);
  const [note, setNote] = useState(existing?.note || '');
  const [saving, setSaving] = useState(false);

  function handleClassChange(nextClassId: string) {
    setClassroomId(nextClassId);
    const found = schedules.find(
      (s) => s.classroom_id === nextClassId && s.topic_id === topic.id
    );
    setLessonDate(found?.lesson_date || today);
    setHwDueDate(found?.hw_due_date || tomorrow);
    setNote(found?.note || '');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!classroomId || !lessonDate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/teacher/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomId,
          topicId: topic.id,
          lessonDate,
          hwDueDate: hwDueDate || null,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Ошибка сохранения');
        return;
      }
      onSaved(data.item as ClassScheduleItem);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!classroomId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/teacher/schedule?classroomId=${classroomId}&topicId=${topic.id}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        onDeleted(classroomId, topic.id);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSave}
        className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-5 sm:p-6 space-y-4 animate-pop"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              📅 Назначить урок классу
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
              {topic.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>

        {classrooms.length === 0 ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            Сначала создай хотя бы один класс (например, 5 «А») в разделе{' '}
            <strong>📊 Журнал → Классы и ученики</strong>.
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Выбери класс
              </label>
              <select
                value={classroomId}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl"
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.join_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Когда этот урок?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLessonDate(today);
                    setHwDueDate(tomorrow);
                  }}
                  className={`py-2.5 rounded-xl border-2 text-xs font-extrabold transition ${
                    lessonDate === today
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-emerald-300'
                  }`}
                >
                  🟢 На сегодня
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLessonDate(tomorrow);
                    setHwDueDate(dayAfter);
                  }}
                  className={`py-2.5 rounded-xl border-2 text-xs font-extrabold transition ${
                    lessonDate === tomorrow
                      ? 'bg-sky-50 border-sky-500 text-sky-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-sky-300'
                  }`}
                >
                  🔵 На завтра
                </button>
              </div>
              <input
                type="date"
                required
                value={lessonDate}
                onChange={(e) => setLessonDate(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Срок сдачи ДЗ (необязательно)
              </label>
              <input
                type="date"
                value={hwDueDate}
                onChange={(e) => setHwDueDate(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Короткое сообщение классу (необязательно)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Например: Повторите признаки делимости перед уроком!"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              {existing ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleRemove}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition"
                >
                  Убрать дату
                </button>
              ) : (
                <div />
              )}

              <button
                type="submit"
                disabled={saving}
                className="btn-tactile px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 border-emerald-800 disabled:opacity-60 text-white text-xs font-extrabold"
              >
                {saving ? 'Сохранение...' : '✓ Назначить классу'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}