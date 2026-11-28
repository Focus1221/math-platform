'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { playSound } from '@/lib/audio/sound';
import {
  closeMathKeyboard,
  openMathKeyboard,
  syncMathKeyboard,
} from '@/lib/keyboard/mathKeyboardStore';

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  examMode?: boolean;
  submitLabel?: string;
  className?: string;
}

export default function MathInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Введи ответ...',
  disabled = false,
  examMode = false,
  submitLabel = '✓ Проверить',
  className = '',
}: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preferNative, setPreferNative] = useState(false);

  const handleSwitchNative = useCallback(() => {
    setPreferNative(true);
    closeMathKeyboard(id);
    const el = inputRef.current;
    if (!el) return;
    el.blur();
    setTimeout(() => {
      el.focus();
    }, 60);
  }, [id]);

  // Синхронизируем внешние изменения (например, сброс поля при следующем примере)
  useEffect(() => {
    syncMathKeyboard(id, {
      value,
      placeholder,
      submitLabel,
      examMode,
      disabled,
      onChange,
      onSubmit,
      onSwitchNative: handleSwitchNative,
      inputRef,
    });
  }, [
    id,
    value,
    placeholder,
    submitLabel,
    examMode,
    disabled,
    onChange,
    onSubmit,
    handleSwitchNative,
  ]);

  useEffect(() => {
    return () => closeMathKeyboard(id);
  }, [id]);

  function openDock() {
    if (disabled) return;
    openMathKeyboard({
      id,
      value,
      placeholder,
      submitLabel,
      examMode,
      disabled,
      onChange,
      onSubmit,
      onSwitchNative: handleSwitchNative,
      inputRef,
    });
    // Плавно поднимаем поле, чтобы нижняя клавиатура его не перекрыла
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }

  return (
    <div data-math-input="true" className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        inputMode={preferNative ? 'text' : 'none'}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onFocus={() => {
          if (!preferNative) openDock();
        }}
        onClick={() => {
          if (!preferNative) openDock();
        }}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full pr-11 ${className}`}
      />

      {!disabled && (
        <button
          type="button"
          title="Открыть математическую клавиатуру MathHub"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            playSound('click');
            setPreferNative(false);
            inputRef.current?.focus();
            openDock();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-700 flex items-center justify-center text-sm transition active:scale-95"
        >
          ⌨️
        </button>
      )}
    </div>
  );
}