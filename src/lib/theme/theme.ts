'use client';

export type AppTheme = 'bright' | 'mint' | 'cosmos';

const STORAGE_KEY = 'mathhub_theme';

export const THEME_OPTIONS: {
  id: AppTheme;
  icon: string;
  label: string;
  desc: string;
}[] = [
  { id: 'bright', icon: '☀️', label: 'Яркая', desc: 'Лёгкая и солнечная' },
  { id: 'mint', icon: '🌿', label: 'Мята', desc: 'Спокойная для глаз' },
  { id: 'cosmos', icon: '🚀', label: 'Космос', desc: 'Стильная тёмная' },
];

export function getSavedTheme(): AppTheme {
  if (typeof window === 'undefined') return 'bright';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === 'mint' || raw === 'cosmos' || raw === 'bright') return raw;
  return 'bright';
}

export function applyTheme(theme: AppTheme): void {
  if (typeof window === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  window.localStorage.setItem(STORAGE_KEY, theme);
  window.dispatchEvent(new Event('mathhub-theme-change'));
}

export function cycleTheme(current: AppTheme): AppTheme {
  if (current === 'bright') return 'mint';
  if (current === 'mint') return 'cosmos';
  return 'bright';
}