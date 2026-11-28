'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { playSound } from '@/lib/audio/sound';
import {
  closeMathKeyboard,
  getMathKeyboardSnapshot,
  subscribeMathKeyboard,
  updateMathKeyboardValue,
} from '@/lib/keyboard/mathKeyboardStore';

interface KeyDef {
  label: string;
  value: string;
  kind?: 'digit' | 'symbol';
  title?: string;
}

const NUMERIC_ROWS: KeyDef[][] = [
  [
    { label: '7', value: '7', kind: 'digit' },
    { label: '8', value: '8', kind: 'digit' },
    { label: '9', value: '9', kind: 'digit' },
    { label: '/', value: '/', kind: 'symbol', title: 'Черта дроби (3/4)' },
  ],
  [
    { label: '4', value: '4', kind: 'digit' },
    { label: '5', value: '5', kind: 'digit' },
    { label: '6', value: '6', kind: 'digit' },
    { label: ',', value: ',', kind: 'symbol', title: 'Десятичная запятая' },
  ],
  [
    { label: '1', value: '1', kind: 'digit' },
    { label: '2', value: '2', kind: 'digit' },
    { label: '3', value: '3', kind: 'digit' },
    { label: '−', value: '-', kind: 'symbol', title: 'Минус' },
  ],
];

const EXTRA_ROWS: KeyDef[][] = [
  [
    { label: 'x', value: 'x', kind: 'digit' },
    { label: 'y', value: 'y', kind: 'digit' },
    { label: 'a', value: 'a', kind: 'digit' },
    { label: 'b', value: 'b', kind: 'digit' },
  ],
  [
    { label: '²', value: '²', kind: 'symbol', title: 'В квадрате' },
    { label: '³', value: '³', kind: 'symbol', title: 'В кубе' },
    { label: '(', value: '(', kind: 'symbol' },
    { label: ')', value: ')', kind: 'symbol' },
  ],
  [
    { label: '+', value: '+', kind: 'symbol' },
    { label: '·', value: '·', kind: 'symbol', title: 'Умножение' },
    { label: '=', value: '=', kind: 'symbol' },
    { label: '<', value: '<', kind: 'symbol' },
  ],
];

export default function MathKeyboardDock() {
  const active = useSyncExternalStore(
    subscribeMathKeyboard,
    getMathKeyboardSnapshot,
    () => null
  );
  const [layout, setLayout] = useState<'num' | 'fx'>('num');

  // Закрытие по Esc и по клику вне клавиатуры и активного поля
  useEffect(() => {
    if (!active) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeMathKeyboard();
      }
    }

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-math-keyboard]')) return;
      if (target.closest('[data-math-input]')) return;
      closeMathKeyboard();
    }

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [active]);

  if (!active || active.disabled) return null;

  function tapFeedback() {
    playSound('click');
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
    }
  }

  function insertText(text: string) {
    const cur = getMathKeyboardSnapshot();
    if (!cur || cur.disabled) return;
    tapFeedback();

    const el = cur.inputRef?.current;
    if (
      el &&
      typeof el.selectionStart === 'number' &&
      typeof el.selectionEnd === 'number'
    ) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = cur.value.slice(0, start) + text + cur.value.slice(end);
      updateMathKeyboardValue(cur.id, next);
      cur.onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + text.length;
        el.setSelectionRange(pos, pos);
      });
      return;
    }

    const next = cur.value + text;
    updateMathKeyboardValue(cur.id, next);
    cur.onChange(next);
  }

  function handleBackspace() {
    const cur = getMathKeyboardSnapshot();
    if (!cur || cur.disabled || cur.value.length === 0) return;
    tapFeedback();

    const el = cur.inputRef?.current;
    if (
      el &&
      typeof el.selectionStart === 'number' &&
      typeof el.selectionEnd === 'number'
    ) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start !== end) {
        const next = cur.value.slice(0, start) + cur.value.slice(end);
        updateMathKeyboardValue(cur.id, next);
        cur.onChange(next);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start, start);
        });
        return;
      }
      if (start > 0) {
        const next = cur.value.slice(0, start - 1) + cur.value.slice(end);
        updateMathKeyboardValue(cur.id, next);
        cur.onChange(next);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start - 1, start - 1);
        });
        return;
      }
    }

    const next = cur.value.slice(0, -1);
    updateMathKeyboardValue(cur.id, next);
    cur.onChange(next);
  }

  function handleClear() {
    const cur = getMathKeyboardSnapshot();
    if (!cur || cur.disabled || cur.value.length === 0) return;
    tapFeedback();
    updateMathKeyboardValue(cur.id, '');
    cur.onChange('');
    cur.inputRef?.current?.focus();
  }

  function handleSubmitKey() {
    const cur = getMathKeyboardSnapshot();
    if (!cur) return;
    tapFeedback();
    if (cur.examMode || !cur.onSubmit) {
      closeMathKeyboard();
      return;
    }
    cur.onSubmit();
  }

  function handleSwitchNative() {
    const cur = getMathKeyboardSnapshot();
    if (!cur) return;
    tapFeedback();
    cur.onSwitchNative?.();
  }

  const rows = layout === 'num' ? NUMERIC_ROWS : EXTRA_ROWS;

  return (
    <div
      data-math-keyboard="true"
      className="fixed bottom-0 inset-x-0 z-[75] px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-none select-none print:hidden"
    >
      <div className="math-kb-shell pointer-events-auto max-w-lg mx-auto rounded-3xl border-2 border-slate-200 bg-white/95 backdrop-blur-xl shadow-2xl p-2.5 sm:p-3 space-y-2 animate-pop">
        {/* Верхняя полоса: живой предпросмотр ответа + переключатели */}
        <div className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0 h-9 px-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between gap-2 overflow-hidden">
            <span
              className={`font-mono text-sm font-extrabold truncate ${
                active.value ? 'text-slate-900' : 'text-slate-400 font-sans font-semibold text-xs'
              }`}
            >
              {active.value || active.placeholder || 'Вводи ответ...'}
            </span>
            {active.value && (
              <span className="w-0.5 h-4 bg-indigo-500 animate-pulse shrink-0" />
            )}
          </div>

          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              tapFeedback();
              setLayout((v) => (v === 'num' ? 'fx' : 'num'));
            }}
            title="Переключить символы и переменные"
            className={`h-9 px-2.5 rounded-xl border text-xs font-extrabold transition shrink-0 ${
              layout === 'fx'
                ? 'bg-indigo-600 text-white border-indigo-700'
                : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 border-slate-200'
            }`}
          >
            {layout === 'num' ? 'x² fx' : '123'}
          </button>

          {active.onSwitchNative && (
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={handleSwitchNative}
              title="Открыть обычную клавиатуру телефона"
              className="h-9 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-extrabold text-slate-700 transition shrink-0"
            >
              АБВ
            </button>
          )}

          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              tapFeedback();
              closeMathKeyboard();
            }}
            title="Скрыть клавиатуру"
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 text-sm font-extrabold text-slate-600 transition shrink-0"
          >
            ⌄
          </button>
        </div>

        {/* Основная сетка 5 колонок */}
        <div className="grid grid-cols-5 gap-1.5">
          {/* Первые 3 строки (4 клавиши + 5-я служебная колонка справа) */}
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="contents">
              {row.map((key) => (
                <button
                  key={key.label}
                  type="button"
                  title={key.title}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => insertText(key.value)}
                  className={`h-12 rounded-2xl border font-extrabold transition active:scale-95 ${
                    key.kind === 'digit'
                      ? 'bg-slate-50 hover:bg-indigo-50 border-slate-200 text-slate-900 font-mono text-lg shadow-2xs'
                      : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-800 text-lg'
                  }`}
                >
                  {key.label}
                </button>
              ))}

              {/* 5-я колонка справа */}
              {rowIdx === 0 && (
                <button
                  type="button"
                  title="Удалить символ"
                  disabled={active.value.length === 0}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={handleBackspace}
                  className="h-12 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-lg font-extrabold disabled:opacity-40 transition active:scale-95"
                >
                  ⌫
                </button>
              )}

              {rowIdx === 1 && (
                <button
                  type="button"
                  title={layout === 'num' ? 'Проценты' : 'Больше'}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => insertText(layout === 'num' ? '%' : '>')}
                  className="h-12 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-base font-extrabold transition active:scale-95"
                >
                  {layout === 'num' ? '%' : '>'}
                </button>
              )}

              {rowIdx === 2 && (
                <button
                  type="button"
                  title={layout === 'num' ? 'Градусы' : 'Черта дроби'}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => insertText(layout === 'num' ? '°' : '/')}
                  className="h-12 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-lg font-extrabold transition active:scale-95"
                >
                  {layout === 'num' ? '°' : '/'}
                </button>
              )}
            </div>
          ))}

          {/* Нижняя 4-я строка: Сброс, 0, Пробел, Проверить/Готово */}
          <button
            type="button"
            title="Очистить поле"
            disabled={active.value.length === 0}
            onPointerDown={(e) => e.preventDefault()}
            onClick={handleClear}
            className="h-12 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-sm font-extrabold disabled:opacity-40 transition active:scale-95"
          >
            C
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => insertText('0')}
            className="h-12 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 text-slate-900 font-mono text-lg font-extrabold shadow-2xs transition active:scale-95"
          >
            0
          </button>

          <button
            type="button"
            title="Пробел (для смешанных чисел)"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => insertText(' ')}
            className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 text-xs font-extrabold transition active:scale-95"
          >
            ␣
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={handleSubmitKey}
            className="col-span-2 h-12 rounded-2xl btn-tactile bg-indigo-600 hover:bg-indigo-700 border-indigo-800 text-white text-xs sm:text-sm font-extrabold shadow-xs transition active:scale-95"
          >
            {active.examMode
              ? '✓ Готово'
              : active.submitLabel || '✓ Проверить'}
          </button>
        </div>
      </div>
    </div>
  );
}