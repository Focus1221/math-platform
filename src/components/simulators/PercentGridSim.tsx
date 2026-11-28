'use client';

import { useEffect, useRef, useState } from 'react';
import MathInput from '@/components/ui/MathInput';
import { gcd, randInt } from '@/lib/math/utils';

interface Props {
  onResult: (isCorrect: boolean) => void;
}

type GridTask =
  | {
      kind: 'paint_decimal';
      target: number;
      label: string;
    }
  | {
      kind: 'paint_fraction';
      target: number;
      label: string;
    }
  | {
      kind: 'read_percent';
      target: number;
    }
  | {
      kind: 'read_decimal';
      target: number;
    };

const FRACTION_TASKS: { n: number; d: number; pct: number }[] = [
  { n: 1, d: 2, pct: 50 },
  { n: 1, d: 4, pct: 25 },
  { n: 3, d: 4, pct: 75 },
  { n: 1, d: 5, pct: 20 },
  { n: 2, d: 5, pct: 40 },
  { n: 3, d: 5, pct: 60 },
  { n: 4, d: 5, pct: 80 },
  { n: 1, d: 10, pct: 10 },
  { n: 3, d: 10, pct: 30 },
  { n: 7, d: 10, pct: 70 },
  { n: 9, d: 10, pct: 90 },
  { n: 1, d: 20, pct: 5 },
  { n: 3, d: 20, pct: 15 },
  { n: 7, d: 20, pct: 35 },
  { n: 9, d: 20, pct: 45 },
];

const DECIMAL_POOL = [5, 8, 10, 12, 15, 20, 24, 25, 30, 35, 40, 45, 50, 60, 65, 75, 80, 90];

const INITIAL_GRID_TASK: GridTask = {
  kind: 'paint_decimal',
  target: 25,
  label: '0,25',
};

function formatDecimal(p: number): string {
  if (p === 0) return '0';
  if (p === 100) return '1';
  return String(Number((p / 100).toFixed(2))).replace('.', ',');
}

function makeCells(count: number): boolean[] {
  return Array.from({ length: 100 }, (_, i) => i < count);
}

function makeTask(): GridTask {
  const roll = randInt(0, 3);
  if (roll === 0) {
    const pct = DECIMAL_POOL[randInt(0, DECIMAL_POOL.length - 1)];
    return {
      kind: 'paint_decimal',
      target: pct,
      label: formatDecimal(pct),
    };
  }
  if (roll === 1) {
    const item = FRACTION_TASKS[randInt(0, FRACTION_TASKS.length - 1)];
    return {
      kind: 'paint_fraction',
      target: item.pct,
      label: `${item.n}/${item.d}`,
    };
  }
  const pct = DECIMAL_POOL[randInt(0, DECIMAL_POOL.length - 1)];
  return roll === 2
    ? { kind: 'read_percent', target: pct }
    : { kind: 'read_decimal', target: pct };
}

export default function PercentGridSim({ onResult }: Props) {
  const [mode, setMode] = useState<'explore' | 'trainer'>('explore');
  const [cells, setCells] = useState<boolean[]>(() => makeCells(25));
  const [dragValue, setDragValue] = useState<boolean | null>(null);

  const [task, setTask] = useState<GridTask>(INITIAL_GRID_TASK);
  const [answerInput, setAnswerInput] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearPendingTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    function stopDrag() {
      setDragValue(null);
    }
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
    return () => {
      clearPendingTimer();
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };
  }, []);

  const filledCount = cells.filter(Boolean).length;
  const g = filledCount > 0 ? gcd(filledCount, 100) : 1;

  const isReadTask =
    mode === 'trainer' && (task.kind === 'read_percent' || task.kind === 'read_decimal');

  function startNewTask() {
    clearPendingTimer();
    const next = makeTask();
    setTask(next);
    setAnswerInput('');
    setFeedback(null);
    if (next.kind === 'read_percent' || next.kind === 'read_decimal') {
      setCells(makeCells(next.target));
    } else {
      setCells(makeCells(0));
    }
  }

  function switchMode(nextMode: 'explore' | 'trainer') {
    clearPendingTimer();
    setMode(nextMode);
    setFeedback(null);
    if (nextMode === 'explore') {
      setCells(makeCells(25));
    } else {
      startNewTask();
    }
  }

  function handleCellDown(idx: number) {
    if (isReadTask) return;
    const nextVal = !cells[idx];
    setDragValue(nextVal);
    setCells((prev) => prev.map((v, i) => (i === idx ? nextVal : v)));
  }

  function handleCellEnter(idx: number) {
    if (isReadTask || dragValue === null) return;
    setCells((prev) =>
      prev[idx] === dragValue ? prev : prev.map((v, i) => (i === idx ? dragValue : v))
    );
  }

  function toggleRow(rowIdx: number) {
    if (isReadTask) return;
    const start = rowIdx * 10;
    const rowAllFilled = cells.slice(start, start + 10).every(Boolean);
    setCells((prev) =>
      prev.map((v, i) => (i >= start && i < start + 10 ? !rowAllFilled : v))
    );
  }

  function handleCheckPaint() {
    clearPendingTimer();
    const ok = filledCount === task.target;
    onResult(ok);
    if (ok) {
      setFeedback({
        ok: true,
        text: `✓ Верно! ${
          task.kind === 'paint_decimal' || task.kind === 'paint_fraction'
            ? `${task.label} = `
            : ''
        }${task.target}% (${task.target} клеток из 100).`,
      });
      timerRef.current = setTimeout(startNewTask, 1300);
    } else {
      setFeedback({
        ok: false,
        text: `✗ Сейчас закрашено ${filledCount} кл. (${filledCount}%). Вспомни: 100% — это весь квадрат из 100 клеток.`,
      });
    }
  }

  function checkReadAnswer() {
    clearPendingTimer();
    const cleaned = answerInput
      .trim()
      .replace(/\s+/g, '')
      .replace(/−/g, '-')
      .replace('%', '')
      .replace(',', '.');
    const num = Number(cleaned);
    if (!cleaned || Number.isNaN(num)) return;

    const ok =
      task.kind === 'read_percent'
        ? Math.abs(num - task.target) < 1e-6
        : Math.abs(num - task.target / 100) < 1e-6;

    onResult(ok);
    if (ok) {
      setFeedback({
        ok: true,
        text: `✓ Отлично! ${task.target} из 100 клеток — это ${task.target}% и десятичная дробь ${formatDecimal(task.target)}.`,
      });
      timerRef.current = setTimeout(startNewTask, 1300);
    } else {
      setFeedback({
        ok: false,
        text:
          task.kind === 'read_percent'
            ? '✗ Неверно. Посчитай число закрашенных клеток: 1 полный ряд = 10%, 1 клетка = 1%.'
            : '✗ Неверно. Чтобы перевести проценты в десятичную дробь, раздели число клеток на 100 (сдвинь запятую на 2 знака влево).',
      });
    }
  }

  function handleCheckRead(e: React.FormEvent) {
    e.preventDefault();
    checkReadAnswer();
  }

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
            Сетка 10×10 (Конструктор)
          </button>
          <button
            type="button"
            onClick={() => switchMode('trainer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              mode === 'trainer' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            Тренажёр: Проценты и дроби
          </button>
        </div>

        {mode === 'trainer' && (
          <button
            type="button"
            onClick={startNewTask}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-xs font-semibold text-slate-700 transition"
          >
            ↻ Новое задание
          </button>
        )}
      </div>

      {mode === 'trainer' && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center">
          {task.kind === 'paint_decimal' && (
            <p className="text-sm sm:text-base font-bold text-slate-800">
              Закрась на сетке 10×10 долю, равную десятичной дроби{' '}
              <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-700">
                {task.label}
              </span>
            </p>
          )}
          {task.kind === 'paint_fraction' && (
            <p className="text-sm sm:text-base font-bold text-slate-800">
              Закрась на сетке 10×10 долю, равную обыкновенной дроби{' '}
              <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-700">
                {task.label}
              </span>
            </p>
          )}
          {task.kind === 'read_percent' && (
            <p className="text-sm sm:text-base font-bold text-slate-800">
              Сколько <span className="text-indigo-700">процентов</span> квадрата закрашено на сетке?
            </p>
          )}
          {task.kind === 'read_decimal' && (
            <p className="text-sm sm:text-base font-bold text-slate-800">
              Запиши закрашенную часть квадрата в виде{' '}
              <span className="text-indigo-700">десятичной дроби</span>:
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
        {/* Левая колонка: интерактивная сетка 10×10 */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 flex flex-col items-center gap-3">
          <div className="flex items-start gap-2 select-none">
            {!isReadTask && (
              <div className="grid grid-rows-10 gap-1 pt-0.5">
                {Array.from({ length: 10 }, (_, r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRow(r)}
                    title={`Закрасить / снять ряд ${r + 1} (10%)`}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-slate-100 hover:bg-indigo-100 text-[10px] font-bold text-slate-500 hover:text-indigo-700 transition"
                  >
                    +10
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-10 gap-1 p-1.5 rounded-xl bg-slate-100 border border-slate-200 touch-none">
              {cells.map((filled, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isReadTask}
                  onPointerDown={() => handleCellDown(idx)}
                  onPointerEnter={() => handleCellEnter(idx)}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-[5px] border transition-colors ${
                    filled
                      ? 'bg-indigo-600 border-indigo-700'
                      : 'bg-white border-slate-200 hover:border-indigo-300'
                  } ${isReadTask ? 'cursor-default' : 'cursor-pointer'}`}
                  aria-label={`Клетка ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {!isReadTask && (
            <div className="flex items-center justify-between w-full max-w-[320px] text-[11px] text-slate-500">
              <span>Кликай по клеткам или жми «+10» слева</span>
              <button
                type="button"
                onClick={() => setCells(makeCells(0))}
                className="font-bold text-rose-600 hover:underline"
              >
                Очистить
              </button>
            </div>
          )}
        </div>

        {/* Правая колонка: перевод или ввод ответа */}
        {mode === 'explore' ? (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-700">Закрашено клеток из 100:</span>
                <span className="text-indigo-600 text-sm">{filledCount}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={filledCount}
                onChange={(e) => setCells(makeCells(Number(e.target.value)))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[0, 10, 20, 25, 50, 75, 100].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCells(makeCells(v))}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-xs font-bold transition"
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2.5 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Проценты:</span>
                <span className="font-extrabold text-indigo-800">{filledCount}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Десятичная дробь:</span>
                <span className="font-extrabold text-slate-900">
                  {formatDecimal(filledCount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Обыкновенная дробь:</span>
                <span className="font-extrabold text-emerald-700">
                  {filledCount === 0
                    ? '0'
                    : filledCount === 100
                      ? '100/100 = 1'
                      : g > 1
                        ? `${filledCount}/100 = ${filledCount / g}/${100 / g}`
                        : `${filledCount}/100`}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-indigo-100">
                <span className="text-slate-500">Осталось до целого (100%):</span>
                <span className="font-bold text-slate-700">{100 - filledCount}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
            {isReadTask ? (
              <form onSubmit={handleCheckRead} className="space-y-3">
                <label className="block text-xs font-bold text-slate-600">
                  {task.kind === 'read_percent'
                    ? 'Введи число процентов (например: 35):'
                    : 'Введи десятичную дробь (например: 0,35):'}
                </label>
                <div className="flex gap-2">
                  <MathInput
                    value={answerInput}
                    onChange={setAnswerInput}
                    onSubmit={checkReadAnswer}
                    placeholder={task.kind === 'read_percent' ? '35%' : '0,35'}
                    className="px-4 py-2.5 text-center text-base font-bold bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition shrink-0"
                  >
                    Проверить
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3 text-center">
                <div className="text-xs font-semibold text-slate-500">
                  Сейчас закрашено клеток:
                </div>
                <div className="text-4xl font-extrabold text-indigo-700">
                  {filledCount} <span className="text-base font-bold text-slate-400">/ 100</span>
                </div>
                <button
                  type="button"
                  onClick={handleCheckPaint}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition"
                >
                  Проверить сетку
                </button>
              </div>
            )}

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
        )}
      </div>
    </div>
  );
}