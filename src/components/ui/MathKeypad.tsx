'use client';

import { useState, type RefObject } from 'react';
import { playSound } from '@/lib/audio/sound';

export interface KeypadKey {
  label: string;
  value: string;
  title?: string;
}

const DEFAULT_SYMBOLS: KeypadKey[] = [
  { label: ',', value: ',', title: 'Десятичная запятая' },
  { label: '/', value: '/', title: 'Черта дроби (например 3/4)' },
  { label: '−', value: '-', title: 'Минус' },
  { label: 'пробел', value: ' ', title: 'Пробел (для смешанных чисел)' },
  { label: '%', value: '%', title: 'Проценты' },
  { label: '°', value: '°', title: 'Градусы' },
];

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

interface Props {
  value: string;
  onChange: (next: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  symbols?: KeypadKey[];
  disabled?: boolean;
  align?: 'center' | 'left';
}

export default function MathKeypad({
  value,
  onChange,
  inputRef,
  symbols = DEFAULT_SYMBOLS,
  disabled = false,
  align = 'center',
}: Props) {
  const [showDigits, setShowDigits] = useState(false);

  function insertText(text: string) {
    if (disabled) return;
    playSound('click');

    const el = inputRef?.current;
    if (
      el &&
      typeof el.selectionStart === 'number' &&
      typeof el.selectionEnd === 'number'
    ) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.slice(0, start) + text + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const nextPos = start + text.length;
        el.setSelectionRange(nextPos, nextPos);
      });
      return;
    }

    onChange(value + text);
    el?.focus();
  }

  function handleBackspace() {
    if (disabled || value.length === 0) return;
    playSound('click');

    const el = inputRef?.current;
    if (
      el &&
      typeof el.selectionStart === 'number' &&
      typeof el.selectionEnd === 'number'
    ) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start !== end) {
        const next = value.slice(0, start) + value.slice(end);
        onChange(next);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start, start);
        });
        return;
      }
      if (start > 0) {
        const next = value.slice(0, start - 1) + value.slice(end);
        onChange(next);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start - 1, start - 1);
        });
        return;
      }
    }

    onChange(value.slice(0, -1));
    el?.focus();
  }

  function handleClear() {
    if (disabled || value.length === 0) return;
    playSound('click');
    onChange('');
    inputRef?.current?.focus();
  }

  return (
    <div className="space-y-2 select-none">
      {/* Компактная строка математических символов */}
      <div
        className={`flex flex-wrap items-center gap-1.5 ${
          align === 'center' ? 'justify-center' : 'justify-start'
        }`}
      >
        {symbols.map((key) => (
          <button
            key={key.label}
            type="button"
            disabled={disabled}
            title={key.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertText(key.value)}
            className="min-w-[36px] h-9 px-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-sm font-extrabold text-slate-800 hover:text-indigo-700 disabled:opacity-40 transition active:scale-95"
          >
            {key.label}
          </button>
        ))}

        <button
          type="button"
          disabled={disabled || value.length === 0}
          title="Удалить последний символ"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleBackspace}
          className="min-w-[40px] h-9 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-sm font-extrabold text-rose-700 disabled:opacity-40 transition active:scale-95"
        >
          ⌫
        </button>

        <button
          type="button"
          disabled={disabled}
          title={showDigits ? 'Скрыть цифры' : 'Открыть цифровую клавиатуру'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            playSound('click');
            setShowDigits((v) => !v);
          }}
          className={`h-9 px-3 rounded-xl border text-xs font-extrabold transition active:scale-95 ${
            showDigits
              ? 'bg-indigo-600 text-white border-indigo-700'
              : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
          }`}
        >
          ⌨️ 123
        </button>
      </div>

      {/* Раскрываемый цифровой блок для телефонов и школьной доски */}
      {showDigits && (
        <div
          className={`flex flex-wrap items-center gap-1.5 p-2 rounded-2xl bg-slate-50 border border-slate-200 animate-pop ${
            align === 'center' ? 'justify-center' : 'justify-start'
          }`}
        >
          {DIGITS.map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertText(digit)}
              className="w-10 h-10 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-base font-extrabold text-slate-900 font-mono transition active:scale-95"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={disabled || value.length === 0}
            title="Очистить поле"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            className="h-10 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-extrabold text-amber-800 disabled:opacity-40 transition active:scale-95"
          >
            Сброс
          </button>
        </div>
      )}
    </div>
  );
}