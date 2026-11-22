'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  normalizeStudentLogin,
  studentLoginToEmail,
  studentPinToPassword,
} from '@/lib/auth/studentLogin';

type AuthView = 'pin' | 'email_login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [view, setView] = useState<AuthView>('pin');

  // Вход ученика по логину + PIN
  const [studentLogin, setStudentLogin] = useState('');
  const [pinCode, setPinCode] = useState('');

  // Обычный вход / регистрация по Email
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [inviteCode, setInviteCode] = useState('');
  const [classCode, setClassCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Автоподстановка логина при переходе по QR-коду (/login?u=ulan5a)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u = params.get('u');
    if (u) {
      setStudentLogin(normalizeStudentLogin(u));
      setView('pin');
    }
  }, []);

  async function handlePinLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const cleanLogin = normalizeStudentLogin(studentLogin);
    const cleanPin = pinCode.trim();

    if (!cleanLogin || cleanPin.length < 4) {
      setError('Введи логин с карточки и 4-значный PIN-код.');
      return;
    }

    setLoading(true);
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: studentLoginToEmail(cleanLogin),
      password: studentPinToPassword(cleanPin),
    });
    setLoading(false);

    if (signErr) {
      setError('Неверный логин или PIN-код. Проверь свою карточку.');
      return;
    }

    router.push('/today');
    router.refresh();
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (signErr) {
      setError('Неверный email или пароль.');
      return;
    }

    router.push('/today');
    router.refresh();
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          password,
          role,
          inviteCode,
          classCode,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Не удалось создать аккаунт.');
        setLoading(false);
        return;
      }

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signErr) {
        setError('Аккаунт создан, но войти не удалось. Попробуй войти вручную.');
        setView('email_login');
        setLoading(false);
        return;
      }

      router.push('/today');
      router.refresh();
    } catch {
      setError('Сетевая ошибка при регистрации.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F7FB] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7 space-y-5">
        <div className="text-center space-y-1.5">
          <Link
            href="/today"
            className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-extrabold text-xl shadow-xs"
          >
            ∑
          </Link>
          <h1 className="text-xl font-extrabold text-slate-900">MathHub</h1>
          <p className="text-xs text-slate-500">
            Выбери удобный способ входа в платформу
          </p>
        </div>

        {/* Переключатель режимов */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200">
          {(
            [
              ['pin', '🎓 По PIN'],
              ['email_login', '📧 Email'],
              ['register', '✨ Создать'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setView(id);
                setError('');
              }}
              className={`py-2 rounded-xl text-xs font-bold transition ${
                view === id
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 animate-shake">
            {error}
          </div>
        )}

        {/* 1. Вход ученика по карточке (Логин + PIN) */}
        {view === 'pin' && (
          <form onSubmit={handlePinLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Твой логин с карточки
              </label>
              <input
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                value={studentLogin}
                onChange={(e) => setStudentLogin(e.target.value)}
                placeholder="Например: aliya5a"
                className="w-full px-4 py-3 text-base font-bold font-mono bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                PIN-код (4 цифры)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full px-4 py-3 text-center text-2xl font-extrabold font-mono tracking-[0.4em] bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-tactile w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 disabled:opacity-60 text-white text-sm font-extrabold"
            >
              {loading ? 'Входим...' : 'Войти на урок →'}
            </button>

            <p className="text-[11px] text-center text-slate-400">
              Забыл PIN-код? Попроси учителя посмотреть карточку в журнале.
            </p>
          </form>
        )}

        {/* 2. Вход по Email (Учитель / старшие) */}
        {view === 'email_login' && (
          <form onSubmit={handleEmailLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.kz"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Пароль
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-tactile w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 disabled:opacity-60 text-white text-sm font-extrabold"
            >
              {loading ? 'Входим...' : 'Войти'}
            </button>
          </form>
        )}

        {/* 3. Регистрация нового аккаунта */}
        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`py-2 rounded-xl border-2 text-xs font-bold transition ${
                  role === 'student'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                🎓 Я ученик
              </button>
              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={`py-2 rounded-xl border-2 text-xs font-bold transition ${
                  role === 'teacher'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                👨‍🏫 Я учитель
              </button>
            </div>

            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Имя и фамилия"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
            />

            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
            />

            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль (минимум 6 символов)"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
            />

            {role === 'teacher' ? (
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Секретный код учителя"
                className="w-full px-3.5 py-2.5 text-sm bg-amber-50/50 border border-amber-200 rounded-xl"
              />
            ) : (
              <input
                type="text"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                placeholder="Код класса (необязательно, напр. 5A-2026)"
                className="w-full px-3.5 py-2.5 text-sm uppercase bg-slate-50 border border-slate-200 rounded-xl"
              />
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-tactile w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 disabled:opacity-60 text-white text-sm font-extrabold"
            >
              {loading ? 'Создаём...' : 'Зарегистрироваться'}
            </button>
          </form>
        )}

        <div className="text-center pt-1">
          <Link
            href="/today"
            className="text-xs font-semibold text-slate-400 hover:text-indigo-600"
          >
            ← Продолжить без входа
          </Link>
        </div>
      </div>
    </div>
  );
}