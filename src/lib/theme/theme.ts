'use client';

export type AppTheme = 'ocean' | 'chalk' | 'sunset' | 'comic' | 'cosmos';

const STORAGE_KEY = 'mathhub_theme';
const THEME_EVENT = 'mathhub-theme-change';

const LEGACY_MAP: Record<string, AppTheme> = {
  bright: 'ocean',
  lab: 'ocean',
  academy: 'ocean',
  mint: 'chalk',
  focus: 'sunset',
  zine: 'comic',
  blueprint: 'cosmos',
};

export interface ThemeOption {
  id: AppTheme;
  icon: string;
  label: string;
  desc: string;
  previewBg: string;
  previewCard: string;
  previewAccent: string;
  isDark?: boolean;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'ocean',
    icon: '🌊',
    label: 'Океанское стекло',
    desc: 'Бирюзовый градиент и матовое стекло',
    previewBg: 'linear-gradient(135deg, #7DD3FC, #99F6E4, #C4B5FD)',
    previewCard: 'rgba(255,255,255,0.82)',
    previewAccent: '#0284C7',
  },
  {
    id: 'chalk',
    icon: '🟢',
    label: 'Школьная доска',
    desc: 'Зелёная доска с меловыми формулами',
    previewBg: 'radial-gradient(circle at 30% 30%, #194D3E, #0B211B)',
    previewCard: '#14382D',
    previewAccent: '#FACC15',
    isDark: true,
  },
  {
    id: 'sunset',
    icon: '🌅',
    label: 'Тёплый закат',
    desc: 'Абрикос, солнце и терракота',
    previewBg: 'linear-gradient(135deg, #FDBA74, #FDA4AF)',
    previewCard: '#FFFBF5',
    previewAccent: '#EA580C',
  },
  {
    id: 'comic',
    icon: '⚡',
    label: 'Комикс-зин',
    desc: 'Жёлтый поп-арт, контуры и Unbounded',
    previewBg: '#FDE047',
    previewCard: '#FFFFFF',
    previewAccent: '#2563EB',
  },
  {
    id: 'cosmos',
    icon: '🌌',
    label: 'Кибер-космос',
    desc: 'Звёзды, неон и тёмное стекло',
    previewBg: 'linear-gradient(135deg, #090D24, #311056, #0C3650)',
    previewCard: 'rgba(15,23,42,0.85)',
    previewAccent: '#6366F1',
    isDark: true,
  },
];

export function normalizeTheme(raw: string | null | undefined): AppTheme {
  if (!raw) return 'ocean';
  if (raw in LEGACY_MAP) return LEGACY_MAP[raw];
  if (THEME_OPTIONS.some((t) => t.id === raw)) return raw as AppTheme;
  return 'ocean';
}

export function getSavedTheme(): AppTheme {
  if (typeof window === 'undefined') return 'ocean';
  try {
    return normalizeTheme(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'ocean';
  }
}

export function applyTheme(theme: AppTheme): void {
  if (typeof window === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Игнорируем ограничения приватного режима
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeTheme(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}