'use client';

import { useEffect, useState } from 'react';
import { gcd, lcm, randInt } from '@/lib/math/utils';

type GenCategory =
  | 'natural'
  | 'arithmetic'
  | 'expressions'
  | 'equations'
  | 'powers'
  | 'fractions_calc'
  | 'decimals'
  | 'percents';

interface GenTask {
  prompt: string;
  answer: string;
  altAnswer?: string;
  placeholder?: string;
  hint: string;
}

const CAT_LABELS: Record<GenCategory, string> = {
  natural: 'Натуральные числа',
  arithmetic: 'Арифметика и порядок действий',
  expressions: 'Буквенные выражения',
  equations: 'Уравнения',
  powers: 'Степени',
  fractions_calc: 'Обыкновенные дроби',
  decimals: 'Десятичные дроби',
  percents: 'Проценты',
};

function resolveCategory(simType: string): GenCategory {
  return simType in CAT_LABELS ? (simType as GenCategory) : 'arithmetic';
}

function generateMathTask(cat: GenCategory, diff: 'base' | 'pro'): GenTask {
  const pro = diff === 'pro';

  if (cat === 'natural') {
    const n = pro ? randInt(120, 998) : randInt(12, 98);
    const nextEven = n % 2 === 0 ? n + 2 : n + 1;
    return {
      prompt: `Запиши наименьшее чётное число, которое строго больше числа ${n}:`,
      answer: String(nextEven),
      hint: `Чётные числа оканчиваются на 0, 2, 4, 6, 8. Проверь числа сразу после ${n}.`,
    };
  }

  if (cat === 'expressions') {
    const a = randInt(2, pro ? 9 : 5);
    const b = randInt(2, pro ? 8 : 5);
    const x = randInt(2, pro ? 12 : 7);
    return {
      prompt: `Упрости выражение ${a}x + ${b}x и найди его значение при x = ${x}:`,
      answer: String((a + b) * x),
      hint: `Сложи коэффициенты: (${a} + ${b}) · x = ${a + b}x, затем умножь ${a + b} на ${x}.`,
    };
  }

  if (cat === 'equations') {
    if (!pro) {
      const x = randInt(4, 35);
      const a = randInt(12, 49);
      return {
        prompt: `Реши уравнение: x + ${a} = ${x + a}`,
        answer: String(x),
        hint: `Чтобы найти неизвестное слагаемое, из суммы ${x + a} вычти ${a}.`,
      };
    }
    const x = randInt(3, 18);
    const k = randInt(2, 7);
    const b = randInt(5, 25);
    const rhs = k * x - b;
    return {
      prompt: `Реши уравнение: ${k} · x − ${b} = ${rhs}`,
      answer: String(x),
      hint: `Шаг 1: ${k}x = ${rhs} + ${b} = ${k * x}. Шаг 2: раздели ${k * x} на ${k}.`,
    };
  }

  if (cat === 'powers') {
    const base = randInt(2, pro ? 9 : 6);
    const exp = pro ? randInt(2, 3) : 2;
    return {
      prompt: `Вычисли значение степени: ${base}${exp === 2 ? '²' : '³'}`,
      answer: String(Math.pow(base, exp)),
      hint: `${base}${exp === 2 ? '²' : '³'} означает умножить ${base} само на себя ${exp} раза.`,
    };
  }

  if (cat === 'fractions_calc') {
    if (!pro) {
      const d = randInt(4, 12);
      const a = randInt(1, d - 1);
      const b = randInt(1, d - 1);
      const sum = a + b;
      const g = gcd(sum, d);
      const ans = d / g === 1 ? String(sum / g) : `${sum / g}/${d / g}`;
      return {
        prompt: `Сложи дроби и (если нужно) сократи ответ: ${a}/${d} + ${b}/${d}`,
        placeholder: 'Например: 3/4 или 2',
        answer: ans,
        altAnswer: `${sum}/${d}`,
        hint: `Сложи числители (${a} + ${b} = ${sum}), затем сократи дробь ${sum}/${d} на ${g}.`,
      };
    }
    const d1 = [2, 3, 4, 5, 6][randInt(0, 4)];
    const d2 = [3, 4, 5, 6, 8][randInt(0, 4)];
    const a = randInt(1, d1 - 1);
    const b = randInt(1, d2 - 1);
    const L = lcm(d1, d2);
    const top = a * (L / d1) + b * (L / d2);
    const g = gcd(top, L);
    const ans = L / g === 1 ? String(top / g) : `${top / g}/${L / g}`;
    return {
      prompt: `Вычисли (ответ запиши дробью a/b): ${a}/${d1} + ${b}/${d2}`,
      placeholder: 'Например: 5/6',
      answer: ans,
      altAnswer: `${top}/${L}`,
      hint: `НОК(${d1}, ${d2}) = ${L}. Получаем ${a * (L / d1)}/${L} + ${b * (L / d2)}/${L} = ${top}/${L}.`,
    };
  }

  if (cat === 'decimals') {
    if (!pro) {
      const a = randInt(12, 85) / 10;
      const b = randInt(11, 65) / 10;
      const ans = Number((a + b).toFixed(2));
      return {
        prompt: `Вычисли сумму: ${String(a).replace('.', ',')} + ${String(b).replace('.', ',')}`,
        placeholder: 'Например: 4,7',
        answer: String(ans).replace('.', ','),
        altAnswer: String(ans),
        hint: `Запиши запятую под запятой и сложи разряды: ${a} + ${b}.`,
      };
    }
    const a = randInt(12, 45) / 10;
    const b = randInt(2, 9);
    const ans = Number((a * b).toFixed(2));
    return {
      prompt: `Умножь: ${String(a).replace('.', ',')} · ${b}`,
      placeholder: 'Например: 12,5',
      answer: String(ans).replace('.', ','),
      altAnswer: String(ans),
      hint: `Умножь ${Math.round(a * 10)} на ${b}, затем отдели запятой 1 знак справа.`,
    };
  }

  if (cat === 'percents') {
    const p = pro ? [15, 25, 35, 40, 60][randInt(0, 4)] : [10, 20, 25, 50][randInt(0, 3)];
    const base = randInt(2, 9) * 20;
    return {
      prompt: `Найди ${p}% от числа ${base}:`,
      answer: String((base * p) / 100),
      hint: `Раздели ${base} на 100 (1% = ${base / 100}) и умножь на ${p}.`,
    };
  }

  const a = randInt(4, pro ? 18 : 10);
  const b = randInt(2, pro ? 9 : 6);
  const c = randInt(5, pro ? 40 : 20);
  return {
    prompt: `Найди значение выражения (соблюдай порядок действий): ${c} + ${a} · ${b}`,
    answer: String(c + a * b),
    hint: `Сначала умножение: ${a} · ${b} = ${a * b}, затем сложение: ${c} + ${a * b}.`,
  };
}

interface Props {
  initialSimType: string;
  onResult: (isCorrect: boolean) => void;
}

export default function TaskGeneratorSim({ initialSimType, onResult }: Props) {
  const [category, setCategory] = useState<GenCategory>(() => resolveCategory(initialSimType));
  const [difficulty, setDifficulty] = useState<'base' | 'pro'>('base');
  const [task, setTask] = useState<GenTask>(() =>
    generateMathTask(resolveCategory(initialSimType), 'base')
  );
  const [input, setInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const nextCat = resolveCategory(initialSimType);
    setCategory(nextCat);
    setTask(generateMathTask(nextCat, difficulty));
    setInput('');
    setShowHint(false);
    setFeedback(null);
  }, [initialSimType]);

  function nextTask(cat = category, diff = difficulty) {
    setTask(generateMathTask(cat, diff));
    setInput('');
    setShowHint(false);
    setFeedback(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const norm = (s: string) => s.trim().replace(/\s+/g, '').replace('.', ',').toLowerCase();
    const raw = norm(input);
    if (!raw) return;

    const ok = raw === norm(task.answer) || (task.altAnswer ? raw === norm(task.altAnswer) : false);
    onResult(ok);
    if (ok) {
      setFeedback({ ok: true, text: `✓ Верно! Ответ: ${task.answer}. Новый пример...` });
      setTimeout(() => nextTask(), 1100);
    } else {
      setShowHint(true);
      setFeedback({ ok: false, text: '✗ Пока неверно. Посмотри подсказку ниже и попробуй ещё раз!' });
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          value={category}
          onChange={(e) => {
            const c = e.target.value as GenCategory;
            setCategory(c);
            nextTask(c, difficulty);
          }}
          className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
        >
          {(Object.entries(CAT_LABELS) as [GenCategory, string][]).map(([k, v]) => (
            <option key={k} value={k}>Тема: {v}</option>
          ))}
        </select>

        <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setDifficulty('base');
              nextTask(category, 'base');
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              difficulty === 'base' ? 'bg-emerald-500 text-white' : 'text-slate-600'
            }`}
          >
            База
          </button>
          <button
            type="button"
            onClick={() => {
              setDifficulty('pro');
              nextTask(category, 'pro');
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              difficulty === 'pro' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            Профи
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4 text-center">
        <p className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
          {task.prompt}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
          <input
            type="text"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={task.placeholder || 'Введи ответ...'}
            className="flex-1 px-4 py-2.5 text-center text-base font-bold bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-xs transition"
          >
            Проверить
          </button>
        </form>

        {feedback && (
          <div className={`text-xs sm:text-sm font-semibold ${feedback.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
            {feedback.text}
          </div>
        )}

        {showHint && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 text-left">
            💡 <strong>Подсказка:</strong> {task.hint}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setShowHint(true)}
            className="text-xs font-semibold text-amber-700 hover:underline"
          >
            💡 Показать подсказку
          </button>
          <span className="text-slate-300">•</span>
          <button
            type="button"
            onClick={() => nextTask()}
            className="text-xs font-semibold text-indigo-600 hover:underline"
          >
            ↻ Другой пример
          </button>
        </div>
      </div>
    </div>
  );
}