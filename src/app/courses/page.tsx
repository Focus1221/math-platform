import { Suspense } from 'react';
import { connection } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import CourseListClient, {
  type MapTopicItem,
} from '@/components/courses/CourseListClient';
import type { Course, Profile } from '@/types/db';

function getKzDateISO(offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(
    now
  );
}

async function CoursesContent() {
  await connection();
  const supabase = await createServerSupabase();
  const todayIso = getKzDateISO(0);
  const tomorrowIso = getKzDateISO(1);

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

  const [{ data: coursesData }, { data: topicsData }, { data: tasksData }] =
    await Promise.all([
      supabase
        .from('courses')
        .select('*')
        .order('grade_number', { ascending: true }),
      supabase
        .from('topics')
        .select(
          'id, course_id, order_index, quarter, section, title, value_example, is_assessment, sim_type'
        )
        .order('order_index', { ascending: true }),
      supabase.from('homework_tasks').select('id, topic_id'),
    ]);

  const courses = (coursesData as Course[]) || [];
  const rawTopics = topicsData || [];

  // Сколько заданий ДЗ прикреплено к каждой теме
  const tasksByTopic = new Map<string, string[]>();
  for (const t of tasksData || []) {
    const list = tasksByTopic.get(t.topic_id) || [];
    list.push(t.id);
    tasksByTopic.set(t.topic_id, list);
  }

  // Прогресс, звёзды, сданные ДЗ и расписание пользователя
  const progressMap = new Map<
    string,
    { completed: boolean; simSolved: number }
  >();
  const starsMap = new Map<
    string,
    {
      slidesDone: boolean;
      practiceDone: boolean;
      practiceSolved: number;
      homeworkDone: boolean;
    }
  >();
  const doneTaskIds = new Set<string>();
  const scheduleBadgeMap = new Map<string, 'today' | 'tomorrow'>();

  if (user) {
    const admin = createAdminSupabase();
    const isTeacher = profile?.role === 'teacher';
    let schQuery = supabase
      .from('class_schedule')
      .select('topic_id, lesson_date');

    if (!isTeacher && profile?.classroom_id) {
      schQuery = schQuery.eq('classroom_id', profile.classroom_id);
    }

    const [
      { data: progRows },
      { data: subRows },
      { data: schRows },
      { data: starRows },
    ] = await Promise.all([
      supabase
        .from('topic_progress')
        .select('topic_id, completed, sim_correct_count')
        .eq('student_id', user.id),
      supabase
        .from('submissions')
        .select('task_id')
        .eq('student_id', user.id),
      isTeacher || profile?.classroom_id
        ? schQuery
        : Promise.resolve({ data: [] }),
      admin
        .from('lesson_stars')
        .select('topic_id, slides_done, practice_done, practice_solved, homework_done')
        .eq('user_id', user.id),
    ]);

    for (const p of progRows || []) {
      progressMap.set(p.topic_id, {
        completed: Boolean(p.completed),
        simSolved: Number(p.sim_correct_count || 0),
      });
    }

    for (const st of starRows || []) {
      starsMap.set(String(st.topic_id), {
        slidesDone: Boolean(st.slides_done),
        practiceDone: Boolean(st.practice_done),
        practiceSolved: Number(st.practice_solved || 0),
        homeworkDone: Boolean(st.homework_done),
      });
    }

    for (const s of subRows || []) {
      doneTaskIds.add(s.task_id);
    }

    for (const sch of schRows || []) {
      if (sch.lesson_date === todayIso) {
        scheduleBadgeMap.set(sch.topic_id, 'today');
      } else if (
        sch.lesson_date === tomorrowIso &&
        scheduleBadgeMap.get(sch.topic_id) !== 'today'
      ) {
        scheduleBadgeMap.set(sch.topic_id, 'tomorrow');
      }
    }
  }

  const mapTopics: MapTopicItem[] = rawTopics.map((t) => {
    const prog = progressMap.get(t.id);
    const star = starsMap.get(t.id);
    const topicTaskIds = tasksByTopic.get(t.id) || [];
    const doneTasks = topicTaskIds.filter((id) => doneTaskIds.has(id)).length;

    return {
      id: t.id,
      course_id: t.course_id,
      order_index: t.order_index,
      quarter: t.quarter,
      section: t.section,
      title: t.title,
      value_example: t.value_example || '',
      is_assessment: Boolean(t.is_assessment),
      sim_type: t.sim_type || 'arithmetic',
      completed: Boolean(prog?.completed),
      simSolved: Math.max(prog?.simSolved || 0, star?.practiceSolved || 0),
      hwTotal: topicTaskIds.length,
      hwDone: doneTasks,
      slidesDone: Boolean(star?.slidesDone),
      practiceDone: Boolean(star?.practiceDone),
      homeworkDone: Boolean(star?.homeworkDone),
      scheduleBadge: scheduleBadgeMap.get(t.id) || null,
    };
  });

  return (
    <CourseListClient
      initialCourses={courses}
      initialTopics={mapTopics}
      profile={profile}
    />
  );
}

export default function CoursesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-500">
          Открываем карту знаний...
        </div>
      }
    >
      <CoursesContent />
    </Suspense>
  );
}