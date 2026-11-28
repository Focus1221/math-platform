'use client';

import { useEffect, useRef, useState } from 'react';
import { gcd, lcm, randInt } from '@/lib/math/utils';

interface Props {
  onResult: (isCorrect: boolean) => void;
}

const INITIAL_PAIR = {
  a: { n: 2, d: 3 },
  b: { n: 3, d: 5 },
};

function makeComparePair() {
  const d1 = randInt(2, 9);
  const d2 = randInt(2, 9);
  return {
    a: { n: randInt(1, d1 - 1), d: d1 },
    b: { n: randInt(1, d2 - 1), d: d2 },
  };
}

function PizzaCircles({ n, d }: { n: number; d: number }) {
  const count = Math.min(3, Math.max(1, Math.ceil(n / d)));
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {Array.from({ length: count }, (_, c) => {
        const filled = Math.max(0, Math.min(d, n - c * d));
        return (
          <svg key={c} viewBox="0 0 120 120" className="w-28 h-28 sm:w-32 sm:h-32 shrink-0">
            {d === 1 ? (
              <circle
                cx={60}
                cy={60}
                r={52}
                fill={filled > 0 ? 'var(--color-indigo-500, #6366F1)' : 'rgba(148, 163, 184, 0.28)'}
                stroke="var(--surface-card, #ffffff)"
                strokeWidth={2}
              />
            ) : (
              Array.from({ length: d }, (_, i) => {
                const a1 = (i / d) * Math.PI * 2 - Math.PI / 2;
                const a2 = ((i + 1) / d) * Math.PI * 2 - Math.PI / 2;
                const x1 = 60 + 52 * Math.cos(a1);
                const y1 = 60 + 52 * Math.sin(a1);
                const x2 = 60 + 52 * Math.cos(a2);
                const y2 = 60 + 52 * Math.sin(a2);
                const largeArc = 1 / d > 0.5 ? 1 : 0;
                return (
                  <path
                    key={i}
                    d={`M60,60 L${x1.toFixed(1)},${y1.toFixed(1)} A52,52 0 ${largeArc},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`}
                    fill={i < filled ? 'var(--color-indigo-500, #6366F1)' : 'rgba(148, 163, 184, 0.28)'}
                    stroke="var(--surface-card, #ffffff)"
                    strokeWidth={2}
                  />
                );
              })
            )}
          </svg>
        );
      })}
    </div>
  );
}

export default function FractionsSim({ onResult }: Props) {
  const [mode, setMode] = useState<'explore' | 'compare'>('explore');
  const [num, setNum] = useState(6);
  const [den, setDen] = useState(8);

  const [pair, setPair] = useState(INITIAL_PAIR);
  const [cmpFeedback, setCmpFeedback] = useState<{ ok: boolean; text: string } | null>(null);

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

  const g = gcd(num, den);
  const isProper = num < den;
  const whole = Math.floor(num / den);
  const rem = num % den;

  function nextCompare() {
    clearPendingTimer();
    setPair(makeComparePair());
    setCmpFeedback(null);
  }

  function handleCompare(sign: '<' | '=' | '>') {
    clearPendingTimer();
    const left = pair.a.n * pair.b.d;
    const right = pair.b.n * pair.a.d;
    const trueSign = left < right ? '<' : left > right ? '>' : '=';
    const commonD = lcm(pair.a.d, pair.b.d);
    const n1 = pair.a.n * (commonD / pair.a.d);
    const n2 = pair.b.n * (commonD / pair.b.d);
    const ok = sign === trueSign;

    onResult(ok);
    if (ok) {
      setCmpFeedback({
        ok: true,
        text: `✓ Верно! Общий знаменатель ${commonD}: ${n1}/${commonD} ${trueSign} ${n2}/${commonD}.`,
      });
      timerRef.current = setTimeout(nextCompare, 1400);
    } else {
      setCmpFeedback({
        ok: false,
        text: `✗ Неверно. Приведи к знаменателю ${commonD}: получим ${n1}/${commonD} и ${n2}/${commonD}.`,
      });
    }
  }

  return (
    <div className="space-y-4">
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
          Конструктор и сокращение
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('compare');
            nextCompare();
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            mode === 'compare' ? 'bg-indigo-600 text-white' : 'text-slate-600'
          }`}
        >
          Сравнение дробей
        </button>
      </div>

      {mode === 'explore' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 flex flex-col items-center gap-4">
            <PizzaCircles n={num} d={den} />
            <div className="w-full space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 text-center">
                Полоска (1 целая разделена на {den} ч.)
              </div>
              <div className="w-full h-7 rounded-xl overflow-hidden border border-slate-300 flex bg-slate-100">
                {Array.from({ length: den }, (_, i) => (
                  <div
                    key={i}
                    className={`flex-1 border-r last:border-r-0 border-white/60 transition-colors ${
                      i < Math.min(num, den) ? 'bg-indigo-500' : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">Числитель (сколько взяли):</span>
                  <span className="text-indigo-600 text-sm">{num}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={den * 2 + 4}
                  value={num}
                  onChange={(e) => setNum(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">Знаменатель (на сколько разделили):</span>
                  <span className="text-indigo-600 text-sm">{den}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={den}
                  onChange={(e) => {
                    const nextDen = Number(e.target.value);
                    setDen(nextDen);
                    if (num > nextDen * 2 + 4) setNum(nextDen * 2 + 4);
                  }}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Вид дроби:</span>
                <span className={`font-bold ${isProper ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {isProper ? 'Правильная (< 1)' : 'Неправильная (≥ 1)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Сокращение (НОД = {g}):</span>
                <span className="font-bold text-indigo-800">
                  {num}/{den} {g > 1 ? `= ${num / g}/${den / g}` : '(несократимая)'}
                </span>
              </div>
              {!isProper && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Смешанное число:</span>
                  <span className="font-bold text-slate-900">
                    {rem === 0 ? whole : `${whole} и ${rem / g}/${den / g}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-5">
          <p className="text-center text-sm font-bold text-slate-800">
            Сравни две дроби, глядя на доли или приведя к общему знаменателю:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="text-center space-y-2">
              <div className="text-2xl font-extrabold text-indigo-700">
                {pair.a.n}/{pair.a.d}
              </div>
              <div className="w-full h-8 rounded-xl overflow-hidden border border-slate-300 flex">
                {Array.from({ length: pair.a.d }, (_, i) => (
                  <div
                    key={i}
                    className={`flex-1 border-r last:border-r-0 border-white/60 ${
                      i < pair.a.n ? 'bg-indigo-500' : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              {(['<', '=', '>'] as const).map((sign) => (
                <button
                  key={sign}
                  type="button"
                  onClick={() => handleCompare(sign)}
                  className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-xl font-extrabold transition"
                >
                  {sign}
                </button>
              ))}
            </div>

            <div className="text-center space-y-2">
              <div className="text-2xl font-extrabold text-emerald-700">
                {pair.b.n}/{pair.b.d}
              </div>
              <div className="w-full h-8 rounded-xl overflow-hidden border border-slate-300 flex">
                {Array.from({ length: pair.b.d }, (_, i) => (
                  <div
                    key={i}
                    className={`flex-1 border-r last:border-r-0 border-white/60 ${
                      i < pair.b.n ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {cmpFeedback && (
            <div
              className={`text-center text-xs sm:text-sm font-semibold ${
                cmpFeedback.ok ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {cmpFeedback.text}
            </div>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={nextCompare}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
            >
              ↻ Другая пара дробей
            </button>
          </div>
        </div>
      )}
    </div>
  );
}