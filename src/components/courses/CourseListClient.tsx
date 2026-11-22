'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AppNav from '@/components/layout/AppNav';
import type { Course, Profile } from '@/types/db';

interface Props {
  initialCourses: Course[];
  profile: Profile | null;
}

export default function CourseListClient({ initialCourses, profile }: Props) {
  const supabase = createClient();
  const isTeacher = profile?.role === 'teacher';

  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [showCreate, setShowCreate] = useState(false);
  const [grade, setGrade] = useState(6);
  const [subject, setSubject] = useState('Математика');
  const [hours, setHours] = useState(170);
  const [saving, setSaving] = useState(false);

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
      <AppNav profile={profile} />

      <main className="max-w-5xl w-full mx-auto px-4 pt-6 pb-24 md:pb-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              📚 Все темы и классы
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Выбери класс, чтобы открыть конспекты, тренажёры и задания по любой теме.
            </p>
          </div>
          {isTeacher && (
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="btn-tactile px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 text-white text-xs sm:text-sm font-bold shadow-xs"
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
                  <option key={g} value={g}>
                    {g} класс
                  </option>
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
              className="btn-tactile py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 text-white text-sm font-bold"
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
                  {isTeacher ? (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                      {c.total_hours} ч · {c.academic_year}
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                      {c.grade_number} класс
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 group-hover:text-indigo-700 transition">
                    {c.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Конспекты, интерактивные тренажёры, домашние задания и ИИ-помощник
                  </p>
                </div>
              </div>
              <div className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                Открыть все темы →
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}