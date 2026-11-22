'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Course, Profile } from '@/types/db';

interface Props {
  initialCourses: Course[];
  profile: Profile | null;
}

export default function CourseListClient({ initialCourses, profile }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const isTeacher = profile?.role === 'teacher';

  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [showCreate, setShowCreate] = useState(false);
  const [grade, setGrade] = useState(6);
  const [subject, setSubject] = useState('Математика');
  const [hours, setHours] = useState(170);
  const [saving, setSaving] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const slugBase = subject.toLowerCase().includes('алг')
      ? 'algebra'
      : subject.toLowerCase().includes('геом')
        ? 'geometry'
        : 'math';
    const slug = `${slugBase}-${grade}-${Date.now().toString().slice(-3)}`;

    const { data, error } = await supabase
      .from('courses')
      .insert({
        slug,
        grade_number: grade,
        subject,
        title: `${subject} · ${grade} класс`,
        academic_year: '2026–2027',
        total_hours: hours,
        is_published: true,
      })
      .select()
      .single();

    if (!error && data) {
      setCourses((prev) => [...prev, data].sort((a, b) => a.grade_number - b.grade_number));
      setShowCreate(false);
    } else if (error) {
      alert('Ошибка создания курса: ' + error.message);
    }
    setSaving(false);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-extrabold text-lg">
              ∑
            </div>
            <div>
              <div className="text-sm sm:text-base font-extrabold text-slate-900">MathHub</div>
              <div className="text-[11px] text-slate-500">Выбери класс и предмет</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {profile ? (
              <>
                {isTeacher && (
                    <>
                  <Link
                    href="/teacher/submissions"
                    className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition"
                  >
                    📥 Проверка ДЗ
                  </Link><Link
                    href="/teacher/journal"
                    className="px-2.5 sm:px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold whitespace-nowrap transition"
                    >
                    📊 Журнал
                    </Link></>
                )}
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700">
                  {isTeacher ? '🛠️ Учитель' : '🎓 Ученик'} · {profile.full_name}
                </span>
                <button
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

      <main className="max-w-6xl w-full mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Курсы по математике</h1>
            <p className="text-sm text-slate-500 mt-1">
              Конспекты с формулами, презентации, интерактивные тренажёры и домашние задания по КТП.
            </p>
          </div>
          {isTeacher && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-sm transition"
            >
              {showCreate ? 'Закрыть форму' : '+ Добавить класс / курс'}
            </button>
          )}
        </div>

        {isTeacher && showCreate && (
          <form
            onSubmit={handleCreateCourse}
            className="bg-white rounded-3xl border-2 border-indigo-200 p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Класс</label>
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
              >
                {[5, 6, 7, 8, 9, 10, 11].map((g) => (
                  <option key={g} value={g}>{g} класс</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Предмет</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="Математика">Математика</option>
                <option value="Алгебра">Алгебра</option>
                <option value="Геометрия">Геометрия</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Часов в год</label>
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition"
            >
              {saving ? 'Создаём...' : 'Создать курс'}
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/courses/${c.slug}`}
              className="group bg-white rounded-3xl border border-slate-200 hover:border-indigo-400 p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 font-extrabold text-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                    {c.grade_number}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                    {c.total_hours} ч · {c.academic_year}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 group-hover:text-indigo-700 transition">
                    {c.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    4 четверти · теория, материалы, симуляторы и домашние задания
                  </p>
                </div>
              </div>
              <div className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                Открыть программу →
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}