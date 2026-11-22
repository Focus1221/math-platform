import { Suspense } from 'react';
import { connection } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import CourseListClient from '@/components/courses/CourseListClient';
import type { Course, Profile } from '@/types/db';

async function CoursesContent() {
  await connection();
  const supabase = await createServerSupabase();
  // ...дальше код без изменений
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = data as Profile | null;
  }

  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .order('grade_number', { ascending: true });

  return (
    <CourseListClient
      initialCourses={(courses as Course[]) || []}
      profile={profile}
    />
  );
}

export default function CoursesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-500">
          Загрузка курсов...
        </div>
      }
    >
      <CoursesContent />
    </Suspense>
  );
}