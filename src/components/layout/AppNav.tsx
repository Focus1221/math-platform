'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isSoundEnabled, playSound, setSoundEnabled } from '@/lib/audio/sound';
import {
  applyTheme,
  cycleTheme,
  getSavedTheme,
  THEME_OPTIONS,
  type AppTheme,
} from '@/lib/theme/theme';
import type { Profile } from '@/types/db';

interface Props {
  profile: Profile | null;
}

const MAIN_LINKS = [
  { href: '/today', label: 'Сегодня', shortLabel: 'Сегодня', icon: '🏠' },
  { href: '/courses', label: 'Карта тем', shortLabel: 'Карта', icon: '🗺️' },
  { href: '/simulators', label: 'Тренажёры', shortLabel: 'Игры', icon: '🎮' },
];

export default function AppNav({ profile }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const isTeacher = profile?.role === 'teacher';

  const [soundOn, setSoundOn] = useState(true);
  const [theme, setTheme] = useState<AppTheme>('bright');
  const [teacherMenuOpen, setTeacherMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
    setTheme(getSavedTheme());

    const syncSound = () => setSoundOn(isSoundEnabled());
    const syncTheme = () => setTheme(getSavedTheme());
    window.addEventListener('mathhub-sound-change', syncSound);
    window.addEventListener('mathhub-theme-change', syncTheme);

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setTeacherMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('mathhub-sound-change', syncSound);
      window.removeEventListener('mathhub-theme-change', syncTheme);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
    if (next) playSound('click');
  }

  function handleCycleTheme() {
    const next = cycleTheme(theme);
    applyTheme(next);
    setTheme(next);
    playSound('click');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const currentThemeMeta =
    THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {/* Логотип */}
          <Link href="/today" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white flex items-center justify-center font-extrabold text-lg shadow-sm group-hover:scale-105 transition">
              ∑
            </div>
            <div>
              <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                MathHub
              </div>
              <div className="text-[11px] font-semibold text-slate-500 hidden sm:block">
                {isTeacher ? 'Студия учителя' : 'Живая математика'}
              </div>
            </div>
          </Link>

          {/* 3 главные вкладки (ПК / планшет) */}
          <nav className="hidden md:flex items-center gap-1 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/70">
            {MAIN_LINKS.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/today' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => playSound('click')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
                    active
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Правая часть: компактное меню учителя, тема, звук, профиль */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isTeacher && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setTeacherMenuOpen((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-extrabold transition ${
                    pathname.startsWith('/teacher') || teacherMenuOpen
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                  }`}
                >
                  <span>👨‍🏫</span>
                  <span className="hidden sm:inline">Кабинет</span>
                  <span className="text-[10px]">▾</span>
                </button>

                {teacherMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 space-y-1 z-50 animate-pop">
                    <Link
                      href="/teacher/journal"
                      onClick={() => setTeacherMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-indigo-50 text-xs font-bold text-slate-800 transition"
                    >
                      <span className="text-base">📊</span>
                      <div>
                        <div>Журнал и классы</div>
                        <div className="text-[10px] font-medium text-slate-500">
                          PIN-карточки, оценки, CSV
                        </div>
                      </div>
                    </Link>
                    <Link
                      href="/teacher/submissions"
                      onClick={() => setTeacherMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-amber-50 text-xs font-bold text-slate-800 transition"
                    >
                      <span className="text-base">📥</span>
                      <div>
                        <div>Проверка ДЗ</div>
                        <div className="text-[10px] font-medium text-slate-500">
                          Фото тетрадей по классам
                        </div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Переключатель темы оформления */}
            <button
              type="button"
              onClick={handleCycleTheme}
              title={`Тема: ${currentThemeMeta.label} (нажми, чтобы сменить)`}
              className="h-9 px-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:border-indigo-300 flex items-center gap-1.5 text-xs font-bold text-slate-700 transition"
            >
              <span className="text-sm leading-none">{currentThemeMeta.icon}</span>
              <span className="hidden lg:inline">{currentThemeMeta.label}</span>
            </button>

            {/* Звук */}
            <button
              type="button"
              onClick={toggleSound}
              title={soundOn ? 'Выключить звуки' : 'Включить звуки'}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center text-sm transition ${
                soundOn
                  ? 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
            >
              {soundOn ? '🔊' : '🔇'}
            </button>

            {profile ? (
              <div className="flex items-center gap-1.5">
                <span className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 max-w-[160px] truncate">
                  {isTeacher ? '✨' : '🎓'} {profile.full_name}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-xs font-bold text-slate-600 transition"
                >
                  Выйти
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="btn-tactile px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 text-white text-xs font-extrabold transition"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Эргономичная нижняя мобильная навигация под большой палец */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 pt-1.5 pb-2 shadow-lg">
        <div className={`grid gap-1.5 ${isTeacher ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {MAIN_LINKS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/today' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => playSound('click')}
                className={`py-2 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
          {isTeacher && (
            <Link
              href="/teacher/journal"
              className={`py-2 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold transition ${
                pathname.startsWith('/teacher')
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <span className="text-lg leading-none">📊</span>
              <span>Журнал</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}