import { Suspense } from 'react';
import { connection } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import TodayClient, {
  type RecentGradedCard,
  type TodayScheduleCard,
} from '@/components/today/TodayClient';
import type { Course, Profile } from '@/types/db';

function getKzDateISO(offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(now);
}

async function TodayContent() {
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

  const { data: coursesData } = await supabase
    .from('courses')
    .select('*')
    .order('grade_number', { ascending: true });
  const courses = (coursesData as Course[]) || [];

  const isTeacher = profile?.role === 'teacher';
  let studentClassroom: { id: string; name: string; join_code: string } | null = null;
  let teacherClassrooms: { id: string; name: string; join_code: string }[] = [];

  if (isTeacher) {
    const { data } = await supabase
      .from('classrooms')
      .select('id, name, join_code')
      .order('name');
    teacherClassrooms = data || [];
  } else if (profile?.classroom_id) {
    const { data } = await supabase
      .from('classrooms')
      .select('id, name, join_code')
      .eq('id', profile.classroom_id)
      .maybeSingle();
    studentClassroom = data || null;
  }

  // Загружаем прогресс пользователя
  let completedTopics = 0;
  let simSolved = 0;
  let bestStreak = 0;
  const completedSet = new Set<string>();

  if (user) {
    const { data: progRows } = await supabase
      .from('topic_progress')
      .select('topic_id, completed, sim_correct_count, sim_streak')
      .eq('student_id', user.id);

    for (const p of progRows || []) {
      if (p.completed) {
        completedTopics++;
        completedSet.add(p.topic_id);
      }
      simSolved += Number(p.sim_correct_count || 0);
      bestStreak = Math.max(bestStreak, Number(p.sim_streak || 0));
    }
  }

  // Загружаем расписание класса (или всех классов для учителя)
  let rawSchedules: {
    id: string;
    classroom_id: string;
    topic_id: string;
    lesson_date: string;
    hw_due_date: string | null;
    note: string;
  }[] = [];

  if (isTeacher || profile?.classroom_id) {
    let q = supabase
      .from('class_schedule')
      .select('id, classroom_id, topic_id, lesson_date, hw_due_date, note')
      .order('lesson_date', { ascending: true });

    if (!isTeacher && profile?.classroom_id) {
      q = q.eq('classroom_id', profile.classroom_id);
    }

    const { data } = await q;
    rawSchedules = data || [];
  }

  const scheduleTopicIds = Array.from(new Set(rawSchedules.map((r) => r.topic_id)));
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const classNameMap = new Map<string, string>();
  if (studentClassroom) classNameMap.set(studentClassroom.id, studentClassroom.name);
  teacherClassrooms.forEach((c) => classNameMap.set(c.id, c.name));

  const topicMap = new Map<
    string,
    {
      id: string;
      course_id: string;
      order_index: number;
      title: string;
      section: string;
      value_example: string;
      is_assessment: boolean;
    }
  >();

  const topicTasksMap = new Map<string, { id: string; points: number }[]>();
  const userSubMap = new Map<string, { score: number; status: string }>();

  if (scheduleTopicIds.length > 0) {
    const [{ data: topicRows }, { data: taskRows }] = await Promise.all([
      supabase
        .from('topics')
        .select('id, course_id, order_index, title, section, value_example, is_assessment')
        .in('id', scheduleTopicIds),
      supabase
        .from('homework_tasks')
        .select('id, topic_id, points')
        .in('topic_id', scheduleTopicIds),
    ]);

    for (const t of topicRows || []) {
      topicMap.set(t.id, t);
    }

    const allTaskIds: string[] = [];
    for (const task of taskRows || []) {
      allTaskIds.push(task.id);
      const list = topicTasksMap.get(task.topic_id) || [];
      list.push({ id: task.id, points: Number(task.points || 0) });
      topicTasksMap.set(task.topic_id, list);
    }

    if (user && allTaskIds.length > 0) {
      const { data: subRows } = await supabase
        .from('submissions')
        .select('task_id, score, status')
        .eq('student_id', user.id)
        .in('task_id', allTaskIds);

      for (const s of subRows || []) {
        userSubMap.set(s.task_id, { score: Number(s.score || 0), status: s.status });
      }
    }
  }

  const schedules: TodayScheduleCard[] = [];
  for (const row of rawSchedules) {
    const topic = topicMap.get(row.topic_id);
    if (!topic) continue;
    const course = courseMap.get(topic.course_id);
    if (!course) continue;

    const tasks = topicTasksMap.get(topic.id) || [];
    let doneTasks = 0;
    let earnedPoints = 0;
    let maxPoints = 0;

    for (const task of tasks) {
      maxPoints += task.points;
      const sub = userSubMap.get(task.id);
      if (sub) {
        doneTasks++;
        earnedPoints += sub.score;
      }
    }

    schedules.push({
      id: row.id,
      classroomId: row.classroom_id,
      classroomName: classNameMap.get(row.classroom_id) || '',
      topicId: topic.id,
      topicOrder: topic.order_index,
      topicTitle: topic.title,
      topicSection: topic.section,
      topicValueExample: topic.value_example || '',
      isAssessment: Boolean(topic.is_assessment),
      courseSlug: course.slug,
      courseTitle: course.title,
      lessonDate: row.lesson_date,
      hwDueDate: row.hw_due_date,
      note: row.note || '',
      totalTasks: tasks.length,
      doneTasks,
      earnedPoints,
      maxPoints,
      isCompleted: completedSet.has(topic.id),
    });
  }

  // Недавно проверенные учителем работы (для ученика)
  const recentGraded: RecentGradedCard[] = [];
  if (user && !isTeacher) {
    const { data: gradedRows } = await supabase
      .from('submissions')
      .select('id, task_id, score, teacher_comment')
      .eq('student_id', user.id)
      .eq('status', 'graded')
      .order('updated_at', { ascending: false })
      .limit(4);

    if (gradedRows && gradedRows.length > 0) {
      const gradedTaskIds = gradedRows.map((g) => g.task_id);
      const { data: gTasks } = await supabase
        .from('homework_tasks')
        .select('id, topic_id, points')
        .in('id', gradedTaskIds);

      const gTopicIds = Array.from(new Set((gTasks || []).map((t) => t.topic_id)));
      const { data: gTopics } = gTopicIds.length
        ? await supabase
            .from('topics')
            .select('id, title, course_id')
            .in('id', gTopicIds)
        : { data: [] };

      const gTaskMap = new Map((gTasks || []).map((t) => [t.id, t]));
      const gTopicMap = new Map((gTopics || []).map((t) => [t.id, t]));

      for (const g of gradedRows) {
        const task = gTaskMap.get(g.task_id);
        const topic = task ? gTopicMap.get(task.topic_id) : null;
        const course = topic ? courseMap.get(topic.course_id) : null;
        if (!task || !topic || !course) continue;
        recentGraded.push({
          id: g.id,
          topicId: topic.id,
          topicTitle: topic.title,
          courseSlug: course.slug,
          score: Number(g.score || 0),
          maxPoints: Number(task.points || 2),
          teacherComment: g.teacher_comment || '',
        });
      }
    }
  }

  return (
    <TodayClient
      profile={profile}
      studentClassroom={studentClassroom}
      teacherClassrooms={teacherClassrooms}
      schedules={schedules}
      recentGraded={recentGraded}
      courses={courses}
      stats={{ completedTopics, simSolved, bestStreak }}
      todayIso={todayIso}
      tomorrowIso={tomorrowIso}
    />
  );
}

export default function TodayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-500">
          Загружаем твой день...
        </div>
      }
    >
      <TodayContent />
    </Suspense>
  );
}