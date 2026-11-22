'use client';

import { useState } from 'react';

type SetOp = 'inter' | 'union' | 'A' | 'B' | 'diffAB' | 'diffBA';

const SET_A_ONLY = [2, 4, 8];
const SET_BOTH = [6, 12];
const SET_B_ONLY = [3, 9, 15];

const OPS: Record<SetOp, { label: string; desc: string; elems: number[]; zones: string[] }> = {
  inter: {
    label: 'A ∩ B (Пересечение)',
    desc: 'Только общие элементы, принадлежащие И множеству A, И множеству B.',
    elems: SET_BOTH,
    zones: ['both'],
  },
  union: {
    label: 'A ∪ B (Объединение)',
    desc: 'Все элементы из A и B вместе, без повторений.',
    elems: [...SET_A_ONLY, ...SET_BOTH, ...SET_B_ONLY].sort((a, b) => a - b),
    zones: ['a', 'both', 'b'],
  },
  A: {
    label: 'Множество A (чётные)',
    desc: 'Все элементы, входящие в круг A.',
    elems: [...SET_A_ONLY, ...SET_BOTH].sort((a, b) => a - b),
    zones: ['a', 'both'],
  },
  B: {
    label: 'Множество B (кратные 3)',
    desc: 'Все элементы, входящие в круг B.',
    elems: [...SET_BOTH, ...SET_B_ONLY].sort((a, b) => a - b),
    zones: ['both', 'b'],
  },
  diffAB: {
    label: 'A \\ B (Только A)',
    desc: 'Элементы, которые есть в A, но отсутствуют в B.',
    elems: SET_A_ONLY,
    zones: ['a'],
  },
  diffBA: {
    label: 'B \\ A (Только B)',
    desc: 'Элементы, которые есть в B, но отсутствуют в A.',
    elems: SET_B_ONLY,
    zones: ['b'],
  },
};

export default function SetsVennSim() {
  const [op, setOp] = useState<SetOp>('inter');
  const cur = OPS[op];
  const zA = cur.zones.includes('a');
  const zBoth = cur.zones.includes('both');
  const zB = cur.zones.includes('b');

  return (
    <div className="space-y-4">
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
              fill={zA ? '#818CF8' : '#F1F5F9'}
              fillOpacity={zA ? 0.45 : 0.8}
              stroke="#4F46E5"
              strokeWidth={2.5}
              className="cursor-pointer"
              onClick={() => setOp('diffAB')}
            />
            <circle
              cx={225}
              cy={110}
              r={82}
              fill={zB ? '#34D399' : '#F1F5F9'}
              fillOpacity={zB ? 0.45 : 0.8}
              stroke="#059669"
              strokeWidth={2.5}
              className="cursor-pointer"
              onClick={() => setOp('diffBA')}
            />
            <circle
              cx={225}
              cy={110}
              r={82}
              clipPath="url(#clipCircleA)"
              fill={zBoth ? '#4F46E5' : '#F8FAFC'}
              fillOpacity={zBoth ? 0.72 : 0.92}
              className="cursor-pointer"
              onClick={() => setOp('inter')}
            />
            <circle cx={135} cy={110} r={82} fill="none" stroke="#4F46E5" strokeWidth={2.5} pointerEvents="none" />
            <circle cx={225} cy={110} r={82} fill="none" stroke="#059669" strokeWidth={2.5} pointerEvents="none" />

            <text x={72} y={34} fontSize={15} fontWeight={800} fill="#4338CA">A</text>
            <text x={278} y={34} fontSize={15} fontWeight={800} fill="#047857">B</text>

            <text x={102} y={88} fontSize={16} fontWeight={700} fill="#1E293B" pointerEvents="none">2</text>
            <text x={86} y={122} fontSize={16} fontWeight={700} fill="#1E293B" pointerEvents="none">4</text>
            <text x={110} y={150} fontSize={16} fontWeight={700} fill="#1E293B" pointerEvents="none">8</text>

            <text x={174} y={98} fontSize={17} fontWeight={800} fill={zBoth ? '#FFFFFF' : '#1E293B'} pointerEvents="none">6</text>
            <text x={170} y={132} fontSize={17} fontWeight={800} fill={zBoth ? '#FFFFFF' : '#1E293B'} pointerEvents="none">12</text>

            <text x={248} y={88} fontSize={16} fontWeight={700} fill="#1E293B" pointerEvents="none">3</text>
            <text x={262} y={122} fontSize={16} fontWeight={700} fill="#1E293B" pointerEvents="none">9</text>
            <text x={236} y={150} fontSize={16} fontWeight={700} fill="#1E293B" pointerEvents="none">15</text>
          </svg>
        </div>

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
      </div>
    </div>
  );
}