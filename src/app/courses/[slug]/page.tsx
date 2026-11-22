import { Suspense } from 'react';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import CourseWorkspace from '@/components/lesson/CourseWorkspace';
import type { Course, Profile, Topic } from '@/types/db';

async function CourseDetailContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  // ...дальше код без изменений
  const supabase = await createServerSupabase();

  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!course) notFound();

  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('course_id', course.id)
    .order('order_index', { ascending: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let profile: Profile | null = null;
  let completedIds: string[] = [];

  if (user) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = prof as Profile | null;

    const { data: prog } = await supabase
      .from('topic_progress')
      .select('topic_id')
      .eq('student_id', user.id)
      .eq('completed', true);

    completedIds = (prog || []).map((p: { topic_id: string }) => p.topic_id);
  }

  return (
    <CourseWorkspace
      course={course as Course}
      initialTopics={(topics as Topic[]) || []}
      initialCompletedIds={completedIds}
      profile={profile}
    />
  );
}

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-500">
          Загрузка программы курса...
        </div>
      }
    >
      <CourseDetailContent params={params} />
    </Suspense>
  );
}