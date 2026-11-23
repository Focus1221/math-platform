'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { playSound } from '@/lib/audio/sound';
import type { LessonSlide, SlideType, SlideVisual, Topic } from '@/types/db';

interface Props {
  topic: Topic;
  onTopicUpdated: (updated: Topic) => void;
}

const TYPE_OPTIONS: { value: SlideType; label: string }[] = [
  { value: 'intro', label: '🚀 Зачем это нужно' },
  { value: 'concept', label: '💡 Главное правило' },
  { value: 'example', label: '👀 Пошаговый разбор' },
  { value: 'trap', label: '⚠️ Ловушка (Ошибка vs Верно)' },
  { value: 'quiz', label: '🎯 Мини-проверка' },
  { value: 'summary', label: '⭐ Шпаргалка урока' },
];

const VISUAL_OPTIONS: { value: '' | SlideVisual['kind']; label: string }[] = [
  { value: '', label: 'Без схемы' },
  { value: 'formula_hero', label: '✨ Крупная формула' },
  { value: 'fraction_bar', label: '🍕 Плитки дробей' },
  { value: 'number_line', label: '📏 Координатный луч' },
  { value: 'percent_grid', label: '💯 Сетка процентов (10×10)' },
  { value: 'angle', label: '📐 Угол с дугой' },
  { value: 'venn', label: '⭕ Круги Эйлера–Венна' },
  { value: 'compare', label: '⚖️ Сравнение 2 карточек' },
];

function createDefaultVisual(kind: SlideVisual['kind']): SlideVisual {
  switch (kind) {
    case 'formula_hero':
      return { kind: 'formula_hero', formula: '$a + b = b + a$', caption: 'Главное правило' };
    case 'fraction_bar':
      return { kind: 'fraction_bar', numerator: 3, denominator: 4, label: 'Дробь 3/4' };
    case 'number_line':
      return {
        kind: 'number_line',
        min: 0,
        max: 10,
        points: [
          { value: 3, label: 'A(3)', highlight: true },
          { value: 7, label: 'B(7)', highlight: true },
        ],
        jump: { from: 3, to: 7, label: '+4' },
      };
    case 'percent_grid':
      return { kind: 'percent_grid', percent: 35, label: '35% = 0,35' };
    case 'angle':
      return { kind: 'angle', degrees: 60, label: 'Острый угол меньше 90°' };
    case 'venn':
      return {
        kind: 'venn',
        leftLabel: 'Множество A',
        rightLabel: 'Множество B',
        leftItems: ['2', '4'],
        bothItems: ['6', '12'],
        rightItems: ['3', '9'],
      };
    case 'compare':
      return {
        kind: 'compare',
        leftTitle: 'Случай 1',
        leftText: 'Описание первого случая',
        rightTitle: 'Случай 2',
        rightText: 'Описание второго случая',
      };
  }
}

export default function SlideStudioPanel({ topic, onTopicUpdated }: Props) {
  const supabase = createClient();

  const [slides, setSlides] = useState<LessonSlide[]>(
    Array.isArray(topic.slides) ? topic.slides : []
  );
  const [wish, setWish] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openEditor, setOpenEditor] = useState(false);

  useEffect(() => {
    setSlides(Array.isArray(topic.slides) ? topic.slides : []);
    setError('');
  }, [topic.id, topic.slides]);

  async function saveSlidesToDb(nextSlides: LessonSlide[]) {
    setSaving(true);
    setError('');
    try {
      const { data, error: dbErr } = await supabase
        .from('topics')
        .update({ slides: nextSlides })
        .eq('id', topic.id)
        .select()
        .single();

      if (dbErr || !data) {
        setError(dbErr?.message || 'Не удалось сохранить слайды');
        return false;
      }

      playSound('success');
      onTopicUpdated(data as Topic);
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/teacher/generate-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, extraWish: wish }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка генерации презентации');
        return;
      }
      const generated = (data.slides || []) as LessonSlide[];
      setSlides(generated);
      await saveSlidesToDb(generated);
      setOpenEditor(true);
    } catch {
      setError('Сетевая ошибка при обращении к ИИ.');
    } finally {
      setGenerating(false);
    }
  }

  function updateSlide(idx: number, patch: Partial<LessonSlide>) {
    setSlides((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    );
  }

  function moveSlide(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    setSlides((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
  }

  function addBlankSlide() {
    const next: LessonSlide = {
      id: `manual-${Date.now()}`,
      type: 'concept',
      title: `Новый слайд ${slides.length + 1}`,
      body_md: 'Краткое объяснение с формулой $a + b = b + a$.',
    };
    setSlides((prev) => [...prev, next]);
    setOpenEditor(true);
  }

  return (
    <div className="rounded-3xl bg-gradient-to-br from-violet-50 via-white to-indigo-50 border-2 border-violet-200 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm sm:text-base font-extrabold text-violet-950">
            ✨ Студия интерактивных слайдов (ИИ)
          </h4>
          <p className="text-xs text-slate-600">
            Gemini соберёт 6–7 наглядных слайдов со схемами, пошаговым примером, ловушкой и 2 мини-тестами.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpenEditor((v) => !v)}
          className="px-3 py-1.5 rounded-xl bg-white border border-violet-200 text-xs font-bold text-violet-800 hover:bg-violet-50"
        >
          {openEditor
            ? 'Скрыть редактор слайдов'
            : `🛠️ Редактировать слайды (${slides.length})`}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={wish}
          onChange={(e) => setWish(e.target.value)}
          placeholder="Пожелание (напр.: добавь схему пиццы дробей и задачу про покупки в тенге)"
          className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-violet-200 rounded-xl focus:outline-none focus:border-violet-500"
        />
        <button
          type="button"
          disabled={generating || saving}
          onClick={handleGenerate}
          className="btn-tactile px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 border-violet-800 disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold shrink-0"
        >
          {generating
            ? '✨ Собираем слайды...'
            : slides.length > 0
              ? '✨ Пересобрать через ИИ'
              : '✨ Собрать презентацию (ИИ)'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
          {error}
        </div>
      )}

      {openEditor && (
        <div className="space-y-3 pt-3 border-t border-violet-200/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={addBlankSlide}
              className="px-3.5 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-50"
            >
              + Добавить слайд
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => saveSlidesToDb(slides)}
              className="btn-tactile px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 border-emerald-800 disabled:opacity-60 text-white text-xs font-extrabold"
            >
              {saving ? 'Сохраняем...' : `💾 Сохранить изменения (${slides.length})`}
            </button>
          </div>

          {slides.length === 0 ? (
            <div className="p-5 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-xs text-slate-500">
              Слайдов пока нет — нажми «✨ Собрать презентацию (ИИ)» выше или «+ Добавить слайд».
            </div>
          ) : (
            <div className="space-y-3">
              {slides.map((s, idx) => (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-xs font-extrabold text-slate-700">
                        #{idx + 1}
                      </span>
                      <select
                        value={s.type}
                        onChange={(e) =>
                          updateSlide(idx, { type: e.target.value as SlideType })
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold"
                      >
                        {TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={s.visual?.kind || ''}
                        onChange={(e) => {
                          const val = e.target.value as '' | SlideVisual['kind'];
                          updateSlide(idx, {
                            visual: val ? createDefaultVisual(val) : null,
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold"
                        title="Встроенная схема слайда"
                      >
                        {VISUAL_OPTIONS.map((opt) => (
                          <option key={opt.value || 'none'} value={opt.value}>
                            📊 {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveSlide(idx, -1)}
                        disabled={idx === 0}
                        className="px-2 py-1 rounded-lg bg-slate-100 disabled:opacity-30 text-xs font-bold"
                        title="Выше"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSlide(idx, 1)}
                        disabled={idx === slides.length - 1}
                        className="px-2 py-1 rounded-lg bg-slate-100 disabled:opacity-30 text-xs font-bold"
                        title="Ниже"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSlides((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold"
                        title="Удалить слайд"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={s.title}
                    onChange={(e) => updateSlide(idx, { title: e.target.value })}
                    placeholder="Заголовок слайда"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl"
                  />

                  <textarea
                    rows={2}
                    value={s.body_md}
                    onChange={(e) => updateSlide(idx, { body_md: e.target.value })}
                    placeholder="Основной текст (поддерживает формулы $LaTeX$)"
                    className="w-full p-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />

                  {/* Редактор параметров встроенной SVG-схемы */}
                  {s.visual && (
                    <VisualMiniEditor
                      visual={s.visual}
                      onChange={(nextVisual) =>
                        updateSlide(idx, { visual: nextVisual })
                      }
                    />
                  )}

                  {s.type === 'example' && (
                    <textarea
                      rows={3}
                      value={(s.steps || []).join('\n')}
                      onChange={(e) =>
                        updateSlide(idx, {
                          steps: e.target.value
                            .split('\n')
                            .map((line) => line.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Шаги решения (каждый шаг с новой строки)"
                      className="w-full p-2.5 text-xs bg-emerald-50/40 border border-emerald-200 rounded-xl"
                    />
                  )}

                  {s.type === 'trap' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={s.wrong_md || ''}
                        onChange={(e) => updateSlide(idx, { wrong_md: e.target.value })}
                        placeholder="❌ Как часто ошибаются"
                        className="px-3 py-2 text-xs bg-rose-50/50 border border-rose-200 rounded-xl"
                      />
                      <input
                        type="text"
                        value={s.right_md || ''}
                        onChange={(e) => updateSlide(idx, { right_md: e.target.value })}
                        placeholder="✅ Как правильно"
                        className="px-3 py-2 text-xs bg-emerald-50/50 border border-emerald-200 rounded-xl"
                      />
                    </div>
                  )}

                  {s.type === 'quiz' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={(s.quiz_options || []).join('; ')}
                        onChange={(e) =>
                          updateSlide(idx, {
                            quiz_options: e.target.value
                              .split(';')
                              .map((v) => v.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="Варианты ответа через ; (например: 12; 15; 18; 24)"
                        className="w-full px-3 py-2 text-xs bg-violet-50/40 border border-violet-200 rounded-xl"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="number"
                          min={1}
                          max={4}
                          value={(s.quiz_correct_index ?? 0) + 1}
                          onChange={(e) =>
                            updateSlide(idx, {
                              quiz_correct_index: Math.max(0, Number(e.target.value) - 1),
                            })
                          }
                          placeholder="№ верного (1-4)"
                          className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                        />
                        <input
                          type="text"
                          value={s.quiz_explanation || ''}
                          onChange={(e) =>
                            updateSlide(idx, { quiz_explanation: e.target.value })
                          }
                          placeholder="Пояснение после верного ответа"
                          className="sm:col-span-2 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  {s.type === 'summary' && (
                    <textarea
                      rows={3}
                      value={(s.takeaways || []).join('\n')}
                      onChange={(e) =>
                        updateSlide(idx, {
                          takeaways: e.target.value
                            .split('\n')
                            .map((line) => line.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Главные выводы шпаргалки (по одному на строку)"
                      className="w-full p-2.5 text-xs bg-indigo-50/40 border border-indigo-200 rounded-xl"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VisualMiniEditor({
  visual,
  onChange,
}: {
  visual: SlideVisual;
  onChange: (next: SlideVisual) => void;
}) {
  return (
    <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200/80 space-y-2">
      <div className="text-[11px] font-extrabold text-indigo-700 uppercase">
        Настройка схемы ({visual.kind})
      </div>

      {visual.kind === 'formula_hero' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            value={visual.formula}
            onChange={(e) => onChange({ ...visual, formula: e.target.value })}
            placeholder="Формула (напр. $S = a \cdot b$)"
            className="px-2.5 py-1.5 text-xs font-mono bg-white border border-indigo-200 rounded-lg"
          />
          <input
            type="text"
            value={visual.caption || ''}
            onChange={(e) => onChange({ ...visual, caption: e.target.value })}
            placeholder="Пояснение под формулой"
            className="px-2.5 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg"
          />
        </div>
      )}

      {visual.kind === 'fraction_bar' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="text-[11px] font-bold text-slate-600">
              Числитель
              <input
                type="number"
                min={0}
                max={16}
                value={visual.numerator}
                onChange={(e) =>
                  onChange({ ...visual, numerator: Number(e.target.value) || 0 })
                }
                className="mt-0.5 w-full px-2 py-1 text-xs bg-white border border-indigo-200 rounded-lg"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              Знаменатель
              <input
                type="number"
                min={1}
                max={16}
                value={visual.denominator}
                onChange={(e) =>
                  onChange({
                    ...visual,
                    denominator: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className="mt-0.5 w-full px-2 py-1 text-xs bg-white border border-indigo-200 rounded-lg"
              />
            </label>
            <label className="col-span-2 text-[11px] font-bold text-slate-600">
              Подпись
              <input
                type="text"
                value={visual.label || ''}
                onChange={(e) => onChange({ ...visual, label: e.target.value })}
                className="mt-0.5 w-full px-2 py-1 text-xs bg-white border border-indigo-200 rounded-lg"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-800 cursor-pointer">
              <input
                type="checkbox"
                checked={visual.compareDenominator !== undefined}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange({
                      ...visual,
                      compareNumerator: 1,
                      compareDenominator: visual.denominator,
                    });
                  } else {
                    const { compareNumerator: _n, compareDenominator: _d, ...rest } =
                      visual;
                    onChange(rest);
                  }
                }}
              />
              Сравнить со второй дробью
            </label>

            {visual.compareDenominator !== undefined && (
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <input
                  type="number"
                  min={0}
                  max={16}
                  value={visual.compareNumerator ?? 1}
                  onChange={(e) =>
                    onChange({
                      ...visual,
                      compareNumerator: Number(e.target.value) || 0,
                    })
                  }
                  className="w-14 px-2 py-1 text-xs bg-white border border-emerald-300 rounded-lg"
                />
                <span>/</span>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={visual.compareDenominator}
                  onChange={(e) =>
                    onChange({
                      ...visual,
                      compareDenominator: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="w-14 px-2 py-1 text-xs bg-white border border-emerald-300 rounded-lg"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {visual.kind === 'percent_grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="text-[11px] font-bold text-slate-600">
            Процент (0–100)
            <input
              type="number"
              min={0}
              max={100}
              value={visual.percent}
              onChange={(e) =>
                onChange({ ...visual, percent: Number(e.target.value) || 0 })
              }
              className="mt-0.5 w-full px-2 py-1 text-xs bg-white border border-indigo-200 rounded-lg"
            />
          </label>
          <label className="sm:col-span-2 text-[11px] font-bold text-slate-600">
            Пояснение
            <input
              type="text"
              value={visual.label || ''}
              onChange={(e) => onChange({ ...visual, label: e.target.value })}
              className="mt-0.5 w-full px-2 py-1 text-xs bg-white border border-indigo-200 rounded-lg"
            />
          </label>
        </div>
      )}

      {visual.kind === 'angle' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="text-[11px] font-bold text-slate-600">
            Градусы (5–355°)
            <input
              type="number"
              min={5}
              max={355}
              value={visual.degrees}
              onChange={(e) =>
                onChange({ ...visual, degrees: Number(e.target.value) || 60 })
              }
              className="mt-0.5 w-full px-2 py-1 text-xs bg-white border border-indigo-200 rounded-lg"
            />
          </label>
          <label className="sm:col-span-2 text-[11px] font-bold text-slate-600">
            Подпись
            <input
              type="text"
              value={visual.label || ''}
              onChange={(e) => onChange({ ...visual, label: e.target.value })}
              className="mt-0.5 w-full px-2 py-1 text-xs bg-white border border-indigo-200 rounded-lg"
            />
          </label>
        </div>
      )}

      {visual.kind === 'number_line' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <label className="text-[11px] font-bold text-slate-600">
              От (min)
              <input
                type="number"
                value={visual.min}
                onChange={(e) =>
                  onChange({ ...visual, min: Number(e.target.value) || 0 })
                }
                className="mt-0.5 w-full px-2 py-1 text-xs bg-white border border-indigo-200 rounded-lg"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              До (max)
              <input
                type="number"
                value={visual.max}
                onChange={(e) =>
                  onChange({ ...visual, max: Number(e.target.value) || 10 })
                }
                className="mt-0.5 w-full px-2 py-1 text-xs bg-white border border-indigo-200 rounded-lg"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              Прыжок от
              <input
                type="number"
                value={visual.jump?.from ?? ''}
                placeholder="—"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    const { jump: _j, ...rest } = visual;
                    onChange(rest);
                  } else {
                    onChange({
                      ...visual,
                      jump: {
                        from: Number(val),
                        to: visual.jump?.to ?? visual.max,
                        label: visual.jump?.label ?? '',
                      },
                    });
                  }
                }}
                className="mt-0.5 w-full px-2 py-1 text-xs bg-white border border-emerald-200 rounded-lg"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              Прыжок до
              <input
                type="number"
                value={visual.jump?.to ?? ''}
                placeholder="—"
                onChange={(e) => {
                  if (!visual.jump && e.target.value === '') return;
                  onChange({
                    ...visual,
                    jump: {
                      from: visual.jump?.from ?? visual.min,
                      to: Number(e.target.value) || 0,
                      label: visual.jump?.label ?? '',
                    },
                  });
                }}
                className="mt-0.5 w-full px-2 py-1 text-xs bg-white border border-emerald-200 rounded-lg"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              Подпись дуги
              <input
                type="text"
                value={visual.jump?.label ?? ''}
                placeholder="+4"
                onChange={(e) =>
                  onChange({
                    ...visual,
                    jump: {
                      from: visual.jump?.from ?? visual.min,
                      to: visual.jump?.to ?? visual.max,
                      label: e.target.value,
                    },
                  })
                }
                className="mt-0.5 w-full px-2 py-1 text-xs bg-white border border-emerald-200 rounded-lg"
              />
            </label>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600">
                Точки на луче
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...visual,
                    points: [
                      ...(visual.points || []),
                      { value: visual.min, label: 'P', highlight: true },
                    ],
                  })
                }
                className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-[11px] font-bold text-indigo-700"
              >
                + Точка
              </button>
            </div>
            {(visual.points || []).map((pt, pIdx) => (
              <div key={pIdx} className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="any"
                  value={pt.value}
                  onChange={(e) => {
                    const nextPts = visual.points.map((p, i) =>
                      i === pIdx ? { ...p, value: Number(e.target.value) || 0 } : p
                    );
                    onChange({ ...visual, points: nextPts });
                  }}
                  className="w-20 px-2 py-1 text-xs bg-white border border-indigo-200 rounded-lg"
                />
                <input
                  type="text"
                  value={pt.label}
                  onChange={(e) => {
                    const nextPts = visual.points.map((p, i) =>
                      i === pIdx ? { ...p, label: e.target.value } : p
                    );
                    onChange({ ...visual, points: nextPts });
                  }}
                  placeholder="Подпись (напр. A(3))"
                  className="flex-1 px-2 py-1 text-xs bg-white border border-indigo-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...visual,
                      points: visual.points.filter((_, i) => i !== pIdx),
                    })
                  }
                  className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {visual.kind === 'venn' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            value={visual.leftLabel}
            onChange={(e) => onChange({ ...visual, leftLabel: e.target.value })}
            placeholder="Левый круг (название)"
            className="px-2.5 py-1.5 text-xs font-bold bg-white border border-indigo-200 rounded-lg"
          />
          <input
            type="text"
            value={visual.rightLabel}
            onChange={(e) => onChange({ ...visual, rightLabel: e.target.value })}
            placeholder="Правый круг (название)"
            className="px-2.5 py-1.5 text-xs font-bold bg-white border border-emerald-200 rounded-lg"
          />
          <input
            type="text"
            value={(visual.leftItems || []).join(', ')}
            onChange={(e) =>
              onChange({
                ...visual,
                leftItems: e.target.value
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Только слева (через запятую)"
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
          />
          <input
            type="text"
            value={(visual.rightItems || []).join(', ')}
            onChange={(e) =>
              onChange({
                ...visual,
                rightItems: e.target.value
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Только справа (через запятую)"
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
          />
          <input
            type="text"
            value={(visual.bothItems || []).join(', ')}
            onChange={(e) =>
              onChange({
                ...visual,
                bothItems: e.target.value
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Общее в центре (через запятую)"
            className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg"
          />
        </div>
      )}

      {visual.kind === 'compare' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <input
              type="text"
              value={visual.leftTitle}
              onChange={(e) => onChange({ ...visual, leftTitle: e.target.value })}
              placeholder="Заголовок слева"
              className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-indigo-200 rounded-lg"
            />
            <textarea
              rows={2}
              value={visual.leftText}
              onChange={(e) => onChange({ ...visual, leftText: e.target.value })}
              placeholder="Текст слева"
              className="w-full p-2 text-xs bg-white border border-indigo-200 rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <input
              type="text"
              value={visual.rightTitle}
              onChange={(e) => onChange({ ...visual, rightTitle: e.target.value })}
              placeholder="Заголовок справа"
              className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-emerald-200 rounded-lg"
            />
            <textarea
              rows={2}
              value={visual.rightText}
              onChange={(e) => onChange({ ...visual, rightText: e.target.value })}
              placeholder="Текст справа"
              className="w-full p-2 text-xs bg-white border border-emerald-200 rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}