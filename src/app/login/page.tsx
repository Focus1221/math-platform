'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'err' | 'ok'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ type: 'err', text: 'Неверный email или пароль.' });
      } else {
        router.push('/courses');
        router.refresh();
      }
      setLoading(false);
      return;
    }

    // Регистрация через серверный роут с проверкой кода учителя
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, role, inviteCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'err', text: data.error || 'Ошибка регистрации.' });
        setLoading(false);
        return;
      }

      // Сразу авторизуем нового пользователя
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErr) {
        setMessage({ type: 'ok', text: 'Аккаунт создан! Теперь войдите с паролем.' });
        setMode('login');
      } else {
        router.push('/courses');
        router.refresh();
      }
    } catch {
      setMessage({ type: 'err', text: 'Сетевая ошибка. Попробуйте ещё раз.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-extrabold text-xl shadow-md">
            ∑
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">MathHub</h1>
            <p className="text-xs text-slate-500">Платформа для изучения математики</p>
          </div>
        </div>

        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setMessage(null);
            }}
            className={`py-2 text-xs font-bold rounded-lg transition ${
              mode === 'login' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setMessage(null);
            }}
            className={`py-2 text-xs font-bold rounded-lg transition ${
              mode === 'register' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Кто вы?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition ${
                      role === 'student'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    🎓 Ученик
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition ${
                      role === 'teacher'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    🛠️ Учитель
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Имя и фамилия</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Например: Алия Серикова"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              {role === 'teacher' && (
                <div>
                  <label className="block text-xs font-bold text-indigo-700 mb-1">
                    Код приглашения учителя
                  </label>
                  <input
                    type="password"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Введите секретный код"
                    className="w-full px-3.5 py-2.5 text-sm bg-indigo-50/50 border border-indigo-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@school.kz"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Пароль</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          {message && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold ${
                message.type === 'err'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold shadow-sm transition"
          >
            {loading
              ? 'Загрузка...'
              : mode === 'login'
                ? 'Войти'
                : role === 'teacher'
                  ? 'Зарегистрироваться как учитель'
                  : 'Создать аккаунт ученика'}
          </button>
        </form>
      </div>
    </div>
  );
}