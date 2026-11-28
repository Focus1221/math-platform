'use client';

import type { RefObject } from 'react';

export interface MathKeyboardConfig {
  id: string;
  value: string;
  placeholder?: string;
  submitLabel?: string;
  examMode?: boolean;
  disabled?: boolean;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  onSwitchNative?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

const listeners = new Set<() => void>();
let snapshot: MathKeyboardConfig | null = null;

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeMathKeyboard(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMathKeyboardSnapshot(): MathKeyboardConfig | null {
  return snapshot;
}

export function openMathKeyboard(config: MathKeyboardConfig): void {
  snapshot = { ...config };
  emit();
}

export function syncMathKeyboard(
  id: string,
  patch: Partial<Omit<MathKeyboardConfig, 'id'>>
): void {
  if (!snapshot || snapshot.id !== id) return;

  const uiChanged =
    (patch.value !== undefined && patch.value !== snapshot.value) ||
    (patch.placeholder !== undefined && patch.placeholder !== snapshot.placeholder) ||
    (patch.submitLabel !== undefined && patch.submitLabel !== snapshot.submitLabel) ||
    (patch.examMode !== undefined && patch.examMode !== snapshot.examMode) ||
    (patch.disabled !== undefined && patch.disabled !== snapshot.disabled);

  snapshot = { ...snapshot, ...patch };
  if (uiChanged) {
    emit();
  }
}

export function updateMathKeyboardValue(id: string, nextValue: string): void {
  if (!snapshot || snapshot.id !== id) return;
  if (snapshot.value === nextValue) return;
  snapshot = { ...snapshot, value: nextValue };
  emit();
}

export function closeMathKeyboard(id?: string): void {
  if (!snapshot) return;
  if (id && snapshot.id !== id) return;
  snapshot = null;
  emit();
}