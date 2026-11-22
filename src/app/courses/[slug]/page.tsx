import { Suspense } from 'react';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import CourseWorkspace from '@/components/lesson/CourseWorkspace';
import type { ClassScheduleItem, Course, Profile, Topic } from '@/types/db';

async function CourseDetailContent({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ topic?: string; tab?: string }>;
}) {
  await connection();
  const [{ slug }, { topic: initialTopicId, tab: initialTab }] = await Promise.all([
    params,
    searchParams,
  ]);

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
  let classrooms: { id: string; name: string; join_code: string }[] = [];
  let schedules: ClassScheduleItem[] = [];

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

    if (profile?.role === 'teacher') {
      const [{ data: clsRows }, { data: schRows }] = await Promise.all([
        supabase.from('classrooms').select('id, name, join_code').order('name'),
        supabase.from('class_schedule').select('*'),
      ]);
      classrooms = clsRows || [];
      schedules = (schRows as ClassScheduleItem[]) || [];
    } else if (profile?.classroom_id) {
      const { data: schRows } = await supabase
        .from('class_schedule')
        .select('*')
        .eq('classroom_id', profile.classroom_id);
      schedules = (schRows as ClassScheduleItem[]) || [];
    }
  }

  return (
    <CourseWorkspace
      course={course as Course}
      initialTopics={(topics as Topic[]) || []}
      initialCompletedIds={completedIds}
      profile={profile}
      classrooms={classrooms}
      initialSchedules={schedules}
      initialTopicId={initialTopicId}
      initialTab={initialTab}
    />
  );
}

export default function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ topic?: string; tab?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-500">
          Загрузка программы курса...
        </div>
      }
    >
      <CourseDetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}