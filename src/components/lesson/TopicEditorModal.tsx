'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Topic } from '@/types/db';

interface Props {
  topic: Topic;
  onClose: () => void;
  onUpdated: (updated: Topic) => void;
  onDeleted: (topicId: string) => void;
}

const SIM_OPTIONS = [
  { value: 'coord_ray', label: '📏 Координатный луч' },
  { value: 'divisibility', label: '⚡ Блиц: Признаки делимости' },
  { value: 'fractions_visual', label: '🍕 Пицца дробей' },
  { value: 'angles', label: '📐 Транспортир' },
  { value: 'sets', label: '⭕ Диаграммы Эйлера–Венна' },
  { value: 'natural', label: '🎲 Генератор: Натуральные числа' },
  { value: 'arithmetic', label: '🎲 Генератор: Арифметика' },
  { value: 'expressions', label: '🎲 Генератор: Буквенные выражения' },
  { value: 'equations', label: '🎲 Генератор: Уравнения' },
  { value: 'powers', label: '🎲 Генератор: Степени' },
  { value: 'fractions_calc', label: '🎲 Генератор: Обыкновенные дроби' },
  { value: 'decimals', label: '🎲 Генератор: Десятичные дроби' },
  { value: 'percents', label: '🎲 Генератор: Проценты' },
];

export default function TopicEditorModal({
  topic,
  onClose,
  onUpdated,
  onDeleted,
}: Props) {
  const supabase = createClient();

  const [title, setTitle] = useState(topic.title);
  const [quarter, setQuarter] = useState<number>(topic.quarter);
  const [section, setSection] = useState(topic.section);
  const [orderIndex, setOrderIndex] = useState(topic.order_index);
  const [dates, setDates] = useState(topic.dates || '');
  const [hours, setHours] = useState(topic.hours || 1);
  const [simType, setSimType] = useState(topic.sim_type || 'arithmetic');
  const [isAssessment, setIsAssessment] = useState(Boolean(topic.is_assessment));
  const [valueExample, setValueExample] = useState(topic.value_example || '');
  const [objectivesText, setObjectivesText] = useState(
    Array.isArray(topic.objectives) ? topic.objectives.join('\n') : ''
  );
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    const objectives = objectivesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const { data, error } = await supabase
      .from('topics')
      .update({
        title: title.trim(),
        quarter,
        section: section.trim() || `Раздел ${quarter} четверти`,
        order_index: Math.max(1, orderIndex),
        dates: dates.trim(),
        hours: Math.max(1, hours),
        sim_type: simType,
        is_assessment: isAssessment,
        value_example: valueExample.trim(),
        objectives,
      })
      .eq('id', topic.id)
      .select()
      .single();

    setSaving(false);

    if (error || !data) {
      alert('Ошибка сохранения темы: ' + error?.message);
      return;
    }

    onUpdated(data as Topic);
    onClose();
  }

  async function handleDelete() {
    if (
      !confirm(
        `Удалить тему «${topic.title}» вместе с её материалами и домашними заданиями?`
      )
    ) {
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('topics').delete().eq('id', topic.id);
    setSaving(false);

    if (error) {
      alert('Ошибка удаления: ' + error.message);
      return;
    }

    onDeleted(topic.id);
    onClose();
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSave}
        className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-xl p-5 sm:p-6 space-y-4 my-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
            ⚙️ Настройки темы урока
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-3">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Название темы
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              № по порядку
            </label>
            <input
              type="number"
              min={1}
              value={orderIndex}
              onChange={(e) => setOrderIndex(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Четверть
            </label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
              className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
            >
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  {q} четверть
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Даты (КТП)
            </label>
            <input
              type="text"
              value={dates}
              onChange={(e) => setDates(e.target.value)}
              placeholder="02.09–04.09"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Часов
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl w-full">
              <input
                type="checkbox"
                checked={isAssessment}
                onChange={(e) => setIsAssessment(e.target.checked)}
                className="accent-amber-600"
              />
              СОР / СОЧ
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Раздел КТП
            </label>
            <input
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Тренажёр по умолчанию
            </label>
            <select
              value={simType}
              onChange={(e) => setSimType(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl"
            >
              {SIM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Контекст урока (жизненный пример)
          </label>
          <textarea
            rows={2}
            value={valueExample}
            onChange={(e) => setValueExample(e.target.value)}
            className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Цели обучения (каждая цель — с новой строки)
          </label>
          <textarea
            rows={3}
            value={objectivesText}
            onChange={(e) => setObjectivesText(e.target.value)}
            placeholder="5.1.1.1 усвоить понятие множества натуральных чисел"
            className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={saving}
            onClick={handleDelete}
            className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition"
          >
            🗑️ Удалить тему
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold transition"
            >
              {saving ? 'Сохранение...' : '💾 Сохранить изменения'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}