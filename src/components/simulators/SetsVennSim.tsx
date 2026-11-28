'use client';

import { useEffect, useRef, useState } from 'react';
import { randInt } from '@/lib/math/utils';

type SetOp = 'inter' | 'union' | 'A' | 'B' | 'diffAB' | 'diffBA';

interface Props {
  onResult?: (isCorrect: boolean) => void;
}

const SET_A_ONLY = [2, 4, 8];
const SET_BOTH = [6, 12];
const SET_B_ONLY = [3, 9, 15];

const OPS: Record<
  SetOp,
  { label: string; short: string; desc: string; elems: number[]; zones: string[] }
> = {
  inter: {
    label: 'A ∩ B (Пересечение)',
    short: 'A ∩ B',
    desc: 'Только общие элементы, принадлежащие И множеству A, И множеству B.',
    elems: SET_BOTH,
    zones: ['both'],
  },
  union: {
    label: 'A ∪ B (Объединение)',
    short: 'A ∪ B',
    desc: 'Все элементы из A и B вместе, без повторений.',
    elems: [...SET_A_ONLY, ...SET_BOTH, ...SET_B_ONLY].sort((a, b) => a - b),
    zones: ['a', 'both', 'b'],
  },
  A: {
    label: 'Множество A (чётные)',
    short: 'A',
    desc: 'Все элементы, входящие в круг A (включая общую область).',
    elems: [...SET_A_ONLY, ...SET_BOTH].sort((a, b) => a - b),
    zones: ['a', 'both'],
  },
  B: {
    label: 'Множество B (кратные 3)',
    short: 'B',
    desc: 'Все элементы, входящие в круг B (включая общую область).',
    elems: [...SET_BOTH, ...SET_B_ONLY].sort((a, b) => a - b),
    zones: ['both', 'b'],
  },
  diffAB: {
    label: 'A \\ B (Только A)',
    short: 'A \\ B',
    desc: 'Элементы, которые есть в A, но отсутствуют в B.',
    elems: SET_A_ONLY,
    zones: ['a'],
  },
  diffBA: {
    label: 'B \\ A (Только B)',
    short: 'B \\ A',
    desc: 'Элементы, которые есть в B, но отсутствуют в A.',
    elems: SET_B_ONLY,
    zones: ['b'],
  },
};

const TRAINER_OPS: SetOp[] = ['inter', 'union', 'diffAB', 'diffBA', 'A', 'B'];

interface VennTask {
  aOnly: number[];
  both: number[];
  bOnly: number[];
  all: number[];
  targetOp: SetOp;
  expected: number[];
}

function makeVennTask(): VennTask {
  const pool = Array.from({ length: 19 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const aOnly = pool.slice(0, 3).sort((x, y) => x - y);
  const both = pool.slice(3, 5).sort((x, y) => x - y);
  const bOnly = pool.slice(5, 8).sort((x, y) => x - y);
  const all = [...aOnly, ...both, ...bOnly].sort((x, y) => x - y);

  const targetOp = TRAINER_OPS[randInt(0, TRAINER_OPS.length - 1)];
  let expected: number[] = [];

  if (targetOp === 'inter') expected = [...both];
  else if (targetOp === 'union') expected = [...all];
  else if (targetOp === 'A') expected = [...aOnly, ...both].sort((x, y) => x - y);
  else if (targetOp === 'B') expected = [...both, ...bOnly].sort((x, y) => x - y);
  else if (targetOp === 'diffAB') expected = [...aOnly];
  else expected = [...bOnly];

  return { aOnly, both, bOnly, all, targetOp, expected };
}

export default function SetsVennSim({ onResult }: Props) {
  const [mode, setMode] = useState<'explore' | 'trainer'>('explore');
  const [op, setOp] = useState<SetOp>('inter');

  const [task, setTask] = useState<VennTask>(() => makeVennTask());
  const [selected, setSelected] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

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

  function nextTask() {
    clearPendingTimer();
    setTask(makeVennTask());
    setSelected([]);
    setChecked(false);
    setFeedback(null);
  }

  function switchMode(nextMode: 'explore' | 'trainer') {
    clearPendingTimer();
    setMode(nextMode);
    if (nextMode === 'trainer') {
      nextTask();
    }
  }

  function toggleElem(n: number) {
    if (checked) return;
    setSelected((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  }

  function handleCheck() {
    const chosen = [...selected].sort((a, b) => a - b);
    const ok =
      chosen.length === task.expected.length &&
      chosen.every((v, idx) => v === task.expected[idx]);

    setChecked(true);
    onResult?.(ok);

    if (ok) {
      setFeedback({
        ok: true,
        text: `✓ Верно! ${OPS[task.targetOp].short} = { ${task.expected.join(', ')} }.`,
      });
      clearPendingTimer();
      timerRef.current = setTimeout(nextTask, 1400);
    } else {
      setFeedback({
        ok: false,
        text: `✗ Не совсем точно. ${OPS[task.targetOp].desc} Верный ответ: { ${task.expected.join(', ')} }.`,
      });
    }
  }

  const activeZones =
    mode === 'explore'
      ? OPS[op].zones
      : checked
        ? OPS[task.targetOp].zones
        : [];
  const zA = activeZones.includes('a');
  const zBoth = activeZones.includes('both');
  const zB = activeZones.includes('b');

  const leftNums = mode === 'explore' ? SET_A_ONLY : task.aOnly;
  const bothNums = mode === 'explore' ? SET_BOTH : task.both;
  const rightNums = mode === 'explore' ? SET_B_ONLY : task.bOnly;
  const cur = OPS[op];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => switchMode('explore')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              mode === 'explore' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            Исследование операций
          </button>
          <button
            type="button"
            onClick={() => switchMode('trainer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              mode === 'trainer' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            Тренажёр: Собери множество
          </button>
        </div>

        {mode === 'trainer' && (
          <button
            type="button"
            onClick={nextTask}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-xs font-semibold text-slate-700 transition"
          >
            ↻ Новое задание
          </button>
        )}
      </div>

      {mode === 'explore' && (
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(OPS) as [SetOp, (typeof OPS)[SetOp]][]).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => setOp(k)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                op === k
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 flex justify-center">
          <svg viewBox="0 0 360 220" className="w-full max-w-[360px] h-auto select-none">
            <defs>
              <clipPath id="clipCircleA">
                <circle cx={135} cy={110} r={82} />
              </clipPath>
            </defs>

            <circle
              cx={135}
              cy={110}
              r={82}
              fill={zA ? '#818CF8' : 'rgba(148, 163, 184, 0.14)'}
              fillOpacity={zA ? 0.42 : 1}
              stroke="#6366F1"
              strokeWidth={2.5}
              className={mode === 'explore' ? 'cursor-pointer' : undefined}
              onClick={() => mode === 'explore' && setOp('diffAB')}
            />
            <circle
              cx={225}
              cy={110}
              r={82}
              fill={zB ? '#34D399' : 'rgba(148, 163, 184, 0.14)'}
              fillOpacity={zB ? 0.42 : 1}
              stroke="#10B981"
              strokeWidth={2.5}
              className={mode === 'explore' ? 'cursor-pointer' : undefined}
              onClick={() => mode === 'explore' && setOp('diffBA')}
            />
            <circle
              cx={225}
              cy={110}
              r={82}
              clipPath="url(#clipCircleA)"
              fill={zBoth ? '#4F46E5' : 'rgba(148, 163, 184, 0.22)'}
              fillOpacity={zBoth ? 0.72 : 1}
              className={mode === 'explore' ? 'cursor-pointer' : undefined}
              onClick={() => mode === 'explore' && setOp('inter')}
            />
            <circle
              cx={135}
              cy={110}
              r={82}
              fill="none"
              stroke="#6366F1"
              strokeWidth={2.5}
              pointerEvents="none"
            />
            <circle
              cx={225}
              cy={110}
              r={82}
              fill="none"
              stroke="#10B981"
              strokeWidth={2.5}
              pointerEvents="none"
            />

            <text x={72} y={34} fontSize={15} fontWeight={800} fill="#6366F1">
              A
            </text>
            <text x={278} y={34} fontSize={15} fontWeight={800} fill="#10B981">
              B
            </text>

            <g className="text-slate-800" pointerEvents="none">
              <text x={102} y={88} textAnchor="middle" fontSize={16} fontWeight={700} fill="currentColor">
                {leftNums[0]}
              </text>
              <text x={88} y={122} textAnchor="middle" fontSize={16} fontWeight={700} fill="currentColor">
                {leftNums[1]}
              </text>
              <text x={110} y={152} textAnchor="middle" fontSize={16} fontWeight={700} fill="currentColor">
                {leftNums[2]}
              </text>

              <text x={252} y={88} textAnchor="middle" fontSize={16} fontWeight={700} fill="currentColor">
                {rightNums[0]}
              </text>
              <text x={268} y={122} textAnchor="middle" fontSize={16} fontWeight={700} fill="currentColor">
                {rightNums[1]}
              </text>
              <text x={246} y={152} textAnchor="middle" fontSize={16} fontWeight={700} fill="currentColor">
                {rightNums[2]}
              </text>
            </g>

            <g className={zBoth ? 'text-white' : 'text-slate-800'} pointerEvents="none">
              <text x={180} y={98} textAnchor="middle" fontSize={17} fontWeight={800} fill="currentColor">
                {bothNums[0]}
              </text>
              <text x={180} y={134} textAnchor="middle" fontSize={17} fontWeight={800} fill="currentColor">
                {bothNums[1]}
              </text>
            </g>
          </svg>
        </div>

        {mode === 'explore' ? (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-indigo-600 uppercase">Выбранная операция</div>
            <div className="text-lg font-extrabold text-slate-900">{cur.label}</div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{cur.desc}</p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-sm font-bold text-indigo-800">
              {'{ '}
              {cur.elems.join(', ')}
              {' }'}
            </div>
            <p className="text-[11px] text-slate-400">
              Подсказка: кликай прямо по областям диаграммы Эйлера–Венна!
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
            <div>
              <div className="text-xs font-bold uppercase text-indigo-600">
                Выбери ВСЕ элементы множества
              </div>
              <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                {OPS[task.targetOp].label}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {task.all.map((n) => {
                const isSel = selected.includes(n);
                const isExp = task.expected.includes(n);
                let cls = isSel
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300';

                if (checked) {
                  if (isExp && isSel) cls = 'bg-emerald-500 text-white border-emerald-600';
                  else if (isExp && !isSel)
                    cls = 'bg-amber-100 text-amber-900 border-amber-400 ring-2 ring-amber-300';
                  else if (!isExp && isSel) cls = 'bg-rose-500 text-white border-rose-600';
                }

                return (
                  <button
                    key={n}
                    type="button"
                    disabled={checked}
                    onClick={() => toggleElem(n)}
                    className={`w-11 h-11 rounded-xl border-2 text-sm font-extrabold transition ${cls}`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

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

            <div>
              {!checked ? (
                <button
                  type="button"
                  onClick={handleCheck}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold transition"
                >
                  Проверить множество
                </button>
              ) : (
                <button
                  type="button"
                  onClick={nextTask}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition"
                >
                  Следующее задание →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}