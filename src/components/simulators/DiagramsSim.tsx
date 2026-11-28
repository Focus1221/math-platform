'use client';

import { useEffect, useRef, useState } from 'react';
import MathKeypad, { type KeypadKey } from '@/components/ui/MathKeypad';
import { randInt } from '@/lib/math/utils';

interface Props {
  onResult: (isCorrect: boolean) => void;
}

interface SliceItem {
  id: string;
  label: string;
  value: number;
  color: string;
}

type DiagramTask =
  | {
      kind: 'angle_from_percent';
      percent: number;
      answer: number;
    }
  | {
      kind: 'percent_from_angle';
      angle: number;
      answer: number;
    }
  | {
      kind: 'bar_percent';
      items: { label: string; value: number; color: string }[];
      targetIdx: number;
      total: number;
      answer: number;
    };

const PALETTE = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#0EA5E9'];

const DIAGRAM_KEYS: KeypadKey[] = [
  { label: ',', value: ',', title: 'Десятичная запятая' },
  { label: '°', value: '°', title: 'Градусы' },
  { label: '%', value: '%', title: 'Проценты' },
];

const INITIAL_DIAGRAM_TASK: DiagramTask = {
  kind: 'angle_from_percent',
  percent: 25,
  answer: 90,
};

const PRESETS: { name: string; items: Omit<SliceItem, 'id' | 'color'>[] }[] = [
  {
    name: 'Кружки 5 класса (30 уч.)',
    items: [
      { label: 'Футбол', value: 12 },
      { label: 'Шахматы', value: 6 },
      { label: 'Рисование', value: 9 },
      { label: 'Робототехника', value: 3 },
    ],
  },
  {
    name: 'Оценки за СОР (20 уч.)',
    items: [
      { label: 'Отлично', value: 6 },
      { label: 'Хорошо', value: 10 },
      { label: 'Удовлетв.', value: 4 },
    ],
  },
  {
    name: 'Режим дня (24 ч.)',
    items: [
      { label: 'Сон', value: 9 },
      { label: 'Школа', value: 6 },
      { label: 'Уроки и кружки', value: 4 },
      { label: 'Отдых', value: 5 },
    ],
  },
];

const CLEAN_PERCENTS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75];
const CLEAN_ANGLES = [36, 54, 72, 90, 108, 144, 180, 216, 270];

function buildPreset(idx: number): SliceItem[] {
  return PRESETS[idx].items.map((item, i) => ({
    id: `s-${idx}-${i}`,
    label: item.label,
    value: item.value,
    color: PALETTE[i % PALETTE.length],
  }));
}

function makeDiagramTask(): DiagramTask {
  const roll = randInt(0, 2);
  if (roll === 0) {
    const percent = CLEAN_PERCENTS[randInt(0, CLEAN_PERCENTS.length - 1)];
    return {
      kind: 'angle_from_percent',
      percent,
      answer: (percent * 360) / 100,
    };
  }
  if (roll === 1) {
    const angle = CLEAN_ANGLES[randInt(0, CLEAN_ANGLES.length - 1)];
    return {
      kind: 'percent_from_angle',
      angle,
      answer: Math.round((angle / 360) * 100),
    };
  }
  const total = randInt(0, 1) === 0 ? 20 : 25;
  const labels = ['Яблоки', 'Груши', 'Бананы', 'Сливы'];
  const v0 = randInt(3, 8);
  const v1 = randInt(3, 7);
  const v2 = randInt(2, 6);
  const v3 = total - v0 - v1 - v2;
  const values = [v0, v1, v2, v3];
  const targetIdx = randInt(0, 3);
  return {
    kind: 'bar_percent',
    items: labels.map((label, i) => ({
      label,
      value: values[i],
      color: PALETTE[i],
    })),
    targetIdx,
    total,
    answer: (values[targetIdx] * 100) / total,
  };
}

function PieSvg({
  slices,
  highlightOnlyFirst = false,
  firstLabel,
}: {
  slices: { label: string; value: number; color: string }[];
  highlightOnlyFirst?: boolean;
  firstLabel?: string;
}) {
  const total = slices.reduce((s, item) => s + Math.max(0, item.value), 0);
  const CX = 110;
  const CY = 110;
  const R = 92;

  if (total <= 0) {
    return (
      <svg viewBox="0 0 220 220" className="w-52 h-52 sm:w-56 sm:h-56 shrink-0">
        <circle cx={CX} cy={CY} r={R} fill="rgba(148, 163, 184, 0.25)" />
        <text
          x={CX}
          y={CY + 4}
          textAnchor="middle"
          fontSize={12}
          className="text-slate-500"
          fill="currentColor"
          fontWeight={700}
        >
          Нет данных
        </text>
      </svg>
    );
  }

  const computedSlices: {
    color: string;
    startDeg: number;
    sliceDeg: number;
    pct: number;
  }[] = [];

  let currentDeg = 0;
  for (const s of slices) {
    const val = Math.max(0, s.value);
    if (val === 0) continue;
    const sliceDeg = (val / total) * 360;
    computedSlices.push({
      color: s.color,
      startDeg: currentDeg,
      sliceDeg,
      pct: Math.round((val / total) * 100),
    });
    currentDeg += sliceDeg;
  }

  return (
    <svg viewBox="0 0 220 220" className="w-52 h-52 sm:w-56 sm:h-56 shrink-0 select-none">
      {computedSlices.map((s, idx) => {
        const { startDeg, sliceDeg, pct } = s;
        const midRad = ((startDeg + sliceDeg / 2 - 90) * Math.PI) / 180;
        const lx = CX + 56 * Math.cos(midRad);
        const ly = CY + 56 * Math.sin(midRad);

        if (sliceDeg >= 359.99) {
          return (
            <g key={idx}>
              <circle cx={CX} cy={CY} r={R} fill={s.color} />
              <text
                x={CX}
                y={CY + 5}
                textAnchor="middle"
                fontSize={14}
                fontWeight={800}
                fill="#ffffff"
              >
                {firstLabel || '100%'}
              </text>
            </g>
          );
        }

        const startRad = ((startDeg - 90) * Math.PI) / 180;
        const endRad = ((startDeg + sliceDeg - 90) * Math.PI) / 180;
        const x1 = CX + R * Math.cos(startRad);
        const y1 = CY + R * Math.sin(startRad);
        const x2 = CX + R * Math.cos(endRad);
        const y2 = CY + R * Math.sin(endRad);
        const largeArc = sliceDeg > 180 ? 1 : 0;

        const textLabel =
          highlightOnlyFirst && idx === 0
            ? firstLabel || `${pct}%`
            : highlightOnlyFirst
              ? ''
              : sliceDeg >= 28
                ? `${pct}%`
                : '';

        return (
          <g key={idx}>
            <path
              d={`M ${CX} ${CY} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`}
              fill={s.color}
              stroke="var(--surface-card, #ffffff)"
              strokeWidth={2}
            />
            {textLabel && (
              <text
                x={lx}
                y={ly + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight={800}
                fill="#ffffff"
              >
                {textLabel}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function DiagramsSim({ onResult }: Props) {
  const [mode, setMode] = useState<'explore' | 'trainer'>('explore');
  const [items, setItems] = useState<SliceItem[]>(() => buildPreset(0));

  const [task, setTask] = useState<DiagramTask>(INITIAL_DIAGRAM_TASK);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearPendingTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    return () => clearPendingTimer();
  }, []);

  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const maxVal = Math.max(1, ...items.map((i) => i.value));

  function updateItem(id: string, patch: Partial<SliceItem>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function addCategory() {
    if (items.length >= 5) return;
    setItems((prev) => [
      ...prev,
      {
        id: `s-${Date.now()}`,
        label: `Группа ${prev.length + 1}`,
        value: 5,
        color: PALETTE[prev.length % PALETTE.length],
      },
    ]);
  }

  function removeCategory(id: string) {
    if (items.length <= 2) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function nextTask() {
    clearPendingTimer();
    setTask(makeDiagramTask());
    setInput('');
    setFeedback(null);
  }

  function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    clearPendingTimer();
    const cleaned = input.trim().replace(/[°%\s]/g, '').replace(',', '.');
    const val = Number(cleaned);
    if (!cleaned || Number.isNaN(val)) return;

    const ok = Math.abs(val - task.answer) < 1e-6;
    onResult(ok);

    if (ok) {
      const unit = task.kind === 'angle_from_percent' ? '°' : '%';
      setFeedback({
        ok: true,
        text: `✓ Точно! Ответ: ${task.answer}${unit}.`,
      });
      timerRef.current = setTimeout(nextTask, 1300);
    } else {
      let hint = '';
      if (task.kind === 'angle_from_percent') {
        hint = `Вспомни: весь круг = 360°, значит 1% = 3,6°. Умножь ${task.percent} на 3,6.`;
      } else if (task.kind === 'percent_from_angle') {
        hint = `Весь круг — 360° (100%). Раздели ${task.angle}° на 360° и умножь на 100% (или раздели на 3,6).`;
      } else {
        const chosen = task.items[task.targetIdx];
        hint = `Всего на диаграмме ${task.total} шт. Раздели ${chosen.value} на ${task.total} и умножь на 100%.`;
      }
      setFeedback({ ok: false, text: `✗ Неверно. ${hint}` });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => {
              clearPendingTimer();
              setMode('explore');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              mode === 'explore' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            Конструктор диаграмм
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('trainer');
              nextTask();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              mode === 'trainer' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            Тренажёр: Градусы и проценты
          </button>
        </div>

        {mode === 'explore' ? (
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p, idx) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setItems(buildPreset(idx))}
                className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-[11px] font-bold text-slate-600 transition"
              >
                {p.name}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={nextTask}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-xs font-semibold text-slate-700 transition"
          >
            ↻ Новое задание
          </button>
        )}
      </div>

      {mode === 'explore' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Круговая диаграмма */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 flex flex-col items-center gap-3">
              <div className="text-xs font-bold uppercase text-slate-500">
                Круговая диаграмма (360° = 100%)
              </div>
              <PieSvg slices={items} />
              <div className="text-xs text-slate-500">
                Сумма значений: <strong className="text-slate-900">{total}</strong> (1 единица ≈{' '}
                <strong>{total > 0 ? (360 / total).toFixed(1) : '0'}°</strong>)
              </div>
            </div>

            {/* Столбчатая диаграмма */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 flex flex-col justify-between gap-4">
              <div className="text-xs font-bold uppercase text-slate-500 text-center">
                Столбчатая диаграмма
              </div>
              <div className="h-48 flex items-end justify-around gap-3 px-2 pt-6 pb-1 border-b-2 border-slate-200">
                {items.map((item) => {
                  const pctHeight = Math.round((Math.max(0, item.value) / maxVal) * 100);
                  return (
                    <div
                      key={item.id}
                      className="flex-1 flex flex-col items-center justify-end h-full gap-1 min-w-0"
                    >
                      <span className="text-xs font-extrabold text-slate-700">
                        {item.value}
                      </span>
                      <div
                        className="w-full max-w-[56px] rounded-t-xl transition-all duration-300"
                        style={{
                          height: `${Math.max(4, pctHeight)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-around gap-2 text-center">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex-1 text-[11px] font-bold text-slate-600 truncate"
                    title={item.label}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Таблица данных с расчётом процентов и градусов */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase text-slate-500">
                Данные и расчёт секторов
              </div>
              {items.length < 5 && (
                <button
                  type="button"
                  onClick={addCategory}
                  className="px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition"
                >
                  + Добавить сектор
                </button>
              )}
            </div>

            <div className="space-y-2">
              {items.map((item) => {
                const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
                const deg = total > 0 ? ((item.value / total) * 360).toFixed(1) : '0.0';
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 items-center p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="col-span-5 sm:col-span-4 flex items-center gap-2 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => updateItem(item.id, { label: e.target.value })}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-3 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(item.id, { value: Math.max(0, item.value - 1) })
                        }
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 font-bold hover:bg-slate-100"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={200}
                        value={item.value}
                        onChange={(e) =>
                          updateItem(item.id, {
                            value: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-12 py-1 text-center font-extrabold bg-white border border-slate-200 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, { value: item.value + 1 })}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 font-bold hover:bg-slate-100"
                      >
                        +
                      </button>
                    </div>
                    <div className="col-span-3 sm:col-span-4 flex flex-wrap justify-end gap-1.5 font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                        {pct}%
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800">
                        {deg}°
                      </span>
                    </div>
                    <div className="col-span-1 text-right">
                      {items.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeCategory(item.id)}
                          className="text-slate-400 hover:text-rose-600 font-bold"
                          title="Удалить"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
            <div className="flex justify-center">
              {task.kind === 'angle_from_percent' && (
                <PieSvg
                  highlightOnlyFirst
                  firstLabel={`${task.percent}%`}
                  slices={[
                    { label: 'Сектор', value: task.percent, color: '#4F46E5' },
                    {
                      label: 'Остальное',
                      value: 100 - task.percent,
                      color: 'rgba(148, 163, 184, 0.25)',
                    },
                  ]}
                />
              )}
              {task.kind === 'percent_from_angle' && (
                <PieSvg
                  highlightOnlyFirst
                  firstLabel={`${task.angle}°`}
                  slices={[
                    { label: 'Сектор', value: task.angle, color: '#10B981' },
                    {
                      label: 'Остальное',
                      value: 360 - task.angle,
                      color: 'rgba(148, 163, 184, 0.25)',
                    },
                  ]}
                />
              )}
              {task.kind === 'bar_percent' && (
                <div className="w-full max-w-xs space-y-2">
                  <div className="h-44 flex items-end justify-around gap-3 px-2 pt-5 pb-1 border-b-2 border-slate-200">
                    {task.items.map((it, idx) => {
                      const maxBar = Math.max(...task.items.map((x) => x.value));
                      const h = Math.round((it.value / maxBar) * 100);
                      const isTarget = idx === task.targetIdx;
                      return (
                        <div
                          key={it.label}
                          className="flex-1 flex flex-col items-center justify-end h-full gap-1"
                        >
                          <span className="text-xs font-extrabold text-slate-800">
                            {it.value}
                          </span>
                          <div
                            className={`w-full max-w-[44px] rounded-t-xl transition ${
                              isTarget ? 'ring-2 ring-offset-2 ring-indigo-500' : 'opacity-65'
                            }`}
                            style={{ height: `${h}%`, backgroundColor: it.color }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-around gap-1 text-center">
                    {task.items.map((it, idx) => (
                      <span
                        key={it.label}
                        className={`flex-1 text-[11px] truncate ${
                          idx === task.targetIdx
                            ? 'font-extrabold text-indigo-700'
                            : 'font-semibold text-slate-500'
                        }`}
                      >
                        {it.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {task.kind === 'angle_from_percent' && (
                <p className="text-sm sm:text-base font-extrabold text-slate-900">
                  Выделенный сектор составляет{' '}
                  <span className="text-indigo-700">{task.percent}%</span> круга. Чему равна
                  его градусная мера (в градусах)?
                </p>
              )}
              {task.kind === 'percent_from_angle' && (
                <p className="text-sm sm:text-base font-extrabold text-slate-900">
                  Градусная мера выделенного сектора равна{' '}
                  <span className="text-emerald-700">{task.angle}°</span>. Сколько это
                  процентов от всего круга?
                </p>
              )}
              {task.kind === 'bar_percent' && (
                <p className="text-sm sm:text-base font-extrabold text-slate-900">
                  Сколько процентов от всех фруктов ({task.total} шт.) составляют{' '}
                  <span className="text-indigo-700">
                    {task.items[task.targetIdx].label.toLowerCase()}
                  </span>{' '}
                  ({task.items[task.targetIdx].value} шт.)?
                </p>
              )}

              <form onSubmit={handleCheck} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  autoComplete="off"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    task.kind === 'angle_from_percent' ? 'Например: 90' : 'Например: 25'
                  }
                  className="flex-1 px-4 py-2.5 text-center text-base font-bold bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition"
                >
                  Проверить
                </button>
              </form>

              <MathKeypad
                value={input}
                onChange={setInput}
                inputRef={inputRef}
                symbols={DIAGRAM_KEYS}
                align="left"
              />

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs sm:text-sm font-semibold border ${
                    feedback.ok
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {feedback.text}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}