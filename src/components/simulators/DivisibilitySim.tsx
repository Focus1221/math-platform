'use client';

import { useState } from 'react';
import { randInt } from '@/lib/math/utils';

interface Props {
  onResult: (isCorrect: boolean) => void;
}

const DIVISORS = [2, 3, 5, 9, 10];
const POOLS = [
  12, 15, 18, 20, 24, 27, 30, 36, 45, 54, 60, 72, 75, 90, 105, 120, 135, 144,
  180, 210, 225, 234, 270, 315, 360, 405, 450, 512, 630, 729, 810, 945, 1230,
  2340, 137, 251,
];

function pickNumber() {
  return POOLS[randInt(0, POOLS.length - 1)];
}

export default function DivisibilitySim({ onResult }: Props) {
  const [num, setNum] = useState(() => pickNumber());
  const [selected, setSelected] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [isOk, setIsOk] = useState(false);

  const digitSum = String(num)
    .split('')
    .reduce((s, d) => s + Number(d), 0);
  const correctSet = DIVISORS.filter((d) => num % d === 0);

  function toggleDivisor(d: number) {
    if (checked) return;
    setSelected((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  function handleCheck() {
    const chosen = [...selected].sort((a, b) => a - b);
    const ok =
      correctSet.length === chosen.length &&
      correctSet.every((v, i) => v === chosen[i]);
    setIsOk(ok);
    setChecked(true);
    onResult(ok);
  }

  function nextCard() {
    setNum(pickNumber());
    setSelected([]);
    setChecked(false);
  }

  return (
    <div className="max-w-xl mx-auto text-center space-y-5">
      <div className="text-xs font-bold uppercase tracking-wider text-indigo-600">
        Блиц-тренажёр · Выбери ВСЕ верные делители числа
      </div>

      <div className="bg-white rounded-3xl py-7 px-6 border-2 border-indigo-100 shadow-xs">
        <div className="text-5xl sm:text-6xl font-extrabold text-slate-900 tracking-tight">
          {num}
        </div>
        <div className="text-xs text-slate-400 mt-2">
          Если число не делится ни на один из делителей — оставь кнопки пустыми и нажми «Проверить»
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {DIVISORS.map((d) => {
          const isSel = selected.includes(d);
          let cls = isSel
            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.03]'
            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300';

          if (checked) {
            const actuallyDiv = num % d === 0;
            if (actuallyDiv && isSel) cls = 'bg-emerald-500 text-white border-emerald-600';
            else if (actuallyDiv && !isSel) cls = 'bg-amber-100 text-amber-900 border-amber-400 ring-2 ring-amber-300';
            else if (!actuallyDiv && isSel) cls = 'bg-rose-500 text-white border-rose-600';
          }

          return (
            <button
              key={d}
              type="button"
              disabled={checked}
              onClick={() => toggleDivisor(d)}
              className={`py-3.5 rounded-2xl border-2 font-extrabold text-base sm:text-lg transition ${cls}`}
            >
              ÷ {d}
            </button>
          );
        })}
      </div>

      {checked && (
        <div
          className={`p-3.5 rounded-2xl text-xs sm:text-sm text-left leading-relaxed border ${
            isOk
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <strong>{isOk ? '✓ Отлично!' : '✗ Есть неточность.'}</strong> Сумма цифр числа {num} равна{' '}
          <strong>{digitSum}</strong>, последняя цифра — <strong>{num % 10}</strong>. Верные делители:{' '}
          <strong>{correctSet.length ? correctSet.join(', ') : 'нет среди 2, 3, 5, 9, 10'}</strong>.
        </div>
      )}

      <div className="flex justify-center">
        {!checked ? (
          <button
            type="button"
            onClick={handleCheck}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-xs transition"
          >
            Проверить
          </button>
        ) : (
          <button
            type="button"
            onClick={nextCard}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-xs transition"
          >
            Следующее число →
          </button>
        )}
      </div>
    </div>
  );
}