'use client';

import { useState } from 'react';
import { randInt } from '@/lib/math/utils';

interface Props {
  onResult: (isCorrect: boolean) => void;
}

const TICKS = Array.from({ length: 13 }, (_, i) => i);

export default function CoordRaySim({ onResult }: Props) {
  const [mode, setMode] = useState<'point' | 'inequality'>('point');
  const [targetPoint, setTargetPoint] = useState(() => randInt(1, 11));
  const [ineq, setIneq] = useState(() => {
    const a = randInt(1, 5);
    return { a, b: Math.min(11, a + randInt(3, 5)) };
  });
  const [selected, setSelected] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  function newTask(nextMode = mode) {
    setSelected([]);
    setFeedback(null);
    if (nextMode === 'point') {
      setTargetPoint(randInt(1, 11));
    } else {
      const a = randInt(1, 5);
      setIneq({ a, b: Math.min(11, a + randInt(3, 5)) });
    }
  }

  function switchMode(nextMode: 'point' | 'inequality') {
    setMode(nextMode);
    newTask(nextMode);
  }

  function handleTickClick(val: number) {
    if (mode === 'point') {
      setSelected([val]);
      if (val === targetPoint) {
        onResult(true);
        setFeedback({
          ok: true,
          text: `✓ Верно! Точка A(${targetPoint}) находится на ${targetPoint} ед. отрезках от нуля.`,
        });
        setTimeout(() => newTask('point'), 1200);
      } else {
        onResult(false);
        const dir = val < targetPoint ? 'правее' : 'левее';
        setFeedback({
          ok: false,
          text: `✗ Ты нажал на ${val}. Число ${targetPoint} находится ${dir}! Попробуй ещё.`,
        });
      }
    } else {
      setFeedback(null);
      setSelected((prev) =>
        prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
      );
    }
  }

  function checkInequality() {
    const expected: number[] = [];
    for (let i = ineq.a + 1; i < ineq.b; i++) expected.push(i);
    const chosen = [...selected].sort((a, b) => a - b);
    const ok =
      expected.length === chosen.length &&
      expected.every((v, idx) => v === chosen[idx]);

    onResult(ok);
    if (ok) {
      setFeedback({
        ok: true,
        text: `✓ Блестяще! Все натуральные решения (${expected.join(', ')}) найдены верно.`,
      });
      setTimeout(() => newTask('inequality'), 1400);
    } else {
      setFeedback({
        ok: false,
        text: `✗ Не совсем точно. Помни: знаки строгие (<), границы ${ineq.a} и ${ineq.b} не входят!`,
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => switchMode('point')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              mode === 'point' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            Поставь точку
          </button>
          <button
            type="button"
            onClick={() => switchMode('inequality')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              mode === 'inequality' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            Двойное неравенство
          </button>
        </div>
        <button
          type="button"
          onClick={() => newTask()}
          className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-xs font-semibold text-slate-700 transition"
        >
          ↻ Новое задание
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center">
        {mode === 'point' ? (
          <p className="text-sm sm:text-base font-bold text-slate-800">
            Кликни по лучу, чтобы отметить точку{' '}
            <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-700">
              A({targetPoint})
            </span>
          </p>
        ) : (
          <p className="text-sm sm:text-base font-bold text-slate-800">
            Отметь на луче ВСЕ натуральные решения неравенства{' '}
            <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-700">
              {ineq.a} &lt; x &lt; {ineq.b}
            </span>
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl p-3 sm:p-5 border border-slate-200 overflow-x-auto">
        <svg viewBox="0 0 720 120" className="w-full min-w-[520px] h-auto select-none">
          {mode === 'inequality' && (
            <rect
              x={40 + ineq.a * 52}
              y={52}
              width={(ineq.b - ineq.a) * 52}
              height={16}
              rx={8}
              fill="#E0E7FF"
              opacity={0.7}
            />
          )}
          <line x1={40} y1={60} x2={695} y2={60} stroke="#334155" strokeWidth={3} strokeLinecap="round" />
          <polygon points="705,60 690,52 690,68" fill="#334155" />
          <text x={692} y={42} fontSize={14} fontWeight={700} fill="#475569">X</text>

          {TICKS.map((n) => {
            const x = 40 + n * 52;
            const isSel = selected.includes(n);
            return (
              <g
                key={n}
                onClick={() => handleTickClick(n)}
                className="cursor-pointer"
              >
                <line x1={x} y1={50} x2={x} y2={70} stroke="#475569" strokeWidth={n === 0 ? 3 : 2} />
                <circle
                  cx={x}
                  cy={60}
                  r={isSel ? 11 : 16}
                  fill={isSel ? '#4F46E5' : 'transparent'}
                  className="hover:fill-indigo-200/70 transition"
                />
                {isSel && <circle cx={x} cy={60} r={5} fill="#ffffff" />}
                <text
                  x={x}
                  y={95}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={isSel ? 800 : 600}
                  fill={isSel ? '#4F46E5' : '#334155'}
                >
                  {n}
                </text>
                {n === 0 && (
                  <text x={x} y={38} textAnchor="middle" fontSize={12} fontWeight={700} fill="#64748B">
                    O
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs sm:text-sm font-semibold min-h-[20px]">
          {feedback && (
            <span className={feedback.ok ? 'text-emerald-600' : 'text-rose-600'}>
              {feedback.text}
            </span>
          )}
        </div>
        {mode === 'inequality' && (
          <button
            type="button"
            onClick={checkInequality}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition"
          >
            Проверить ответ
          </button>
        )}
      </div>
    </div>
  );
}