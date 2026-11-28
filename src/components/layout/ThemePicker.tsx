'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { playSound } from '@/lib/audio/sound';
import {
  applyTheme,
  getSavedTheme,
  subscribeTheme,
  THEME_OPTIONS,
  type AppTheme,
} from '@/lib/theme/theme';

interface Props {
  compact?: boolean;
}

export default function ThemePicker({ compact = false }: Props) {
  const theme = useSyncExternalStore<AppTheme>(
    subscribeTheme,
    getSavedTheme,
    () => 'ocean'
  );
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const current =
    THEME_OPTIONS.find((opt) => opt.id === theme) || THEME_OPTIONS[0];

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => {
          playSound('click');
          setOpen((v) => !v);
        }}
        title={`Мир оформления: ${current.label}`}
        className={`h-9 rounded-xl border border-slate-200 bg-slate-50 hover:border-indigo-300 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 transition ${
          compact ? 'px-2.5' : 'px-2.5 sm:px-3'
        }`}
      >
        <span className="text-sm leading-none">{current.icon}</span>
        {!compact && (
          <span className="hidden lg:inline">{current.label}</span>
        )}
        <span className="text-[10px] opacity-60">▾</span>
      </button>

      {open && (
        <div className="theme-popover fixed left-3 right-3 top-[68px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl p-2 space-y-1.5 z-50 animate-pop">
          <div className="px-2 pt-1 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Выбери атмосферу MathHub
          </div>

          {THEME_OPTIONS.map((opt) => {
            const active = opt.id === theme;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  applyTheme(opt.id);
                  playSound('click');
                  setOpen(false);
                }}
                className={`w-full text-left p-2 rounded-xl flex items-center gap-3 transition border ${
                  active
                    ? 'bg-indigo-50 border-indigo-400'
                    : 'hover:bg-slate-50 border-transparent'
                }`}
              >
                {/* Миниатюра мира */}
                <div
                  className="w-12 h-9 rounded-lg p-1.5 flex items-end justify-between shrink-0 border border-black/15 shadow-xs"
                  style={{ background: opt.previewBg }}
                >
                  <div
                    className="w-5 h-5 rounded-sm border border-black/10"
                    style={{ background: opt.previewCard }}
                  />
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/50"
                    style={{ background: opt.previewAccent }}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold text-slate-900 truncate flex items-center gap-1.5">
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                    {active && (
                      <span className="ml-auto text-[11px] font-extrabold text-indigo-600">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">
                    {opt.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}