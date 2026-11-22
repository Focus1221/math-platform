'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isSoundEnabled, playSound, setSoundEnabled } from '@/lib/audio/sound';
import type { Profile } from '@/types/db';

interface Props {
  profile: Profile | null;
}

const MAIN_LINKS = [
  { href: '/today', label: 'Сегодня', shortLabel: 'Сегодня', icon: '🏠' },
  { href: '/courses', label: 'Все темы', shortLabel: 'Темы', icon: '📚' },
  { href: '/simulators', label: 'Тренажёры', shortLabel: 'Тренажёры', icon: '🎮' },
];

export default function AppNav({ profile }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const isTeacher = profile?.role === 'teacher';

  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
    const sync = () => setSoundOn(isSoundEnabled());
    window.addEventListener('mathhub-sound-change', sync);
    return () => window.removeEventListener('mathhub-sound-change', sync);
  }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
    if (next) playSound('click');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {/* Логотип */}
          <Link href="/today" className="flex items-center gap-2.5 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-extrabold text-lg shadow-xs">
              ∑
            </div>
            <div>
              <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                MathHub
              </div>
              <div className="text-[11px] text-slate-500 hidden sm:block">
                {isTeacher ? 'Кабинет учителя' : 'Учись легко'}
              </div>
            </div>
          </Link>

          {/* 3 главные вкладки (ПК / планшет) */}
          <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/70">
            {MAIN_LINKS.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/today' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    active
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Правая часть: кнопки учителя, звук, профиль */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isTeacher && (
              <>
                <Link
                  href="/teacher/journal"
                  className={`hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                    pathname.startsWith('/teacher/journal')
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                  }`}
                >
                  📊 Журнал
                </Link>
                <Link
                  href="/teacher/submissions"
                  className={`hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                    pathname.startsWith('/teacher/submissions')
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                  }`}
                >
                  📥 Проверка ДЗ
                </Link>
              </>
            )}

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
              <>
                <span className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 max-w-[180px] truncate">
                  {isTeacher ? '🛠️' : '🎓'} {profile.full_name}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-xs font-bold text-slate-600 transition"
                >
                  Выйти
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Нижняя мобильная навигация под большой палец */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 px-2 py-1.5">
        <div className={`grid gap-1 ${isTeacher ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {MAIN_LINKS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/today' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`py-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition ${
                  active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
          {isTeacher && (
            <Link
              href="/teacher/journal"
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition ${
                pathname.startsWith('/teacher')
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-500'
              }`}
            >
              <span className="text-base leading-none">📊</span>
              <span>Журнал</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}