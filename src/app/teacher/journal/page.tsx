import { Suspense } from 'react';
import { connection } from 'next/server';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import JournalClient, {
  type ClassroomRow,
  type JournalCourse,
  type JournalTopic,
  type ProgressEntry,
  type StudentRow,
  type TopicScoreEntry,
} from '@/components/teacher/JournalClient';

async function JournalContent() {
  await connection();
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
          <h1 className="text-lg font-extrabold">Нужен вход в аккаунт</h1>
          <Link
            href="/login"
            className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
          >
            Войти
          </Link>
        </div>
      </div>
    );
  }

  const admin = createAdminSupabase();
  const { data: me } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (me?.role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-rose-200 p-8 text-center space-y-3">
          <h1 className="text-lg font-extrabold">Доступ только для учителя</h1>
          <Link
            href="/courses"
            className="inline-block px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
          >
            ← К курсам
          </Link>
        </div>
      </div>
    );
  }

  const [
    { data: classRows },
    { data: studentProfiles },
    { data: authUsersData },
    { data: courseRows },
    { data: topicRows },
    { data: taskRows },
    { data: progressRows },
    { data: submissionRows },
  ] = await Promise.all([
    admin.from('classrooms').select('id, name, join_code, grade_number').order('name'),
    admin
      .from('profiles')
      .select('id, full_name, classroom_id')
      .eq('role', 'student')
      .order('full_name'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('courses').select('id, title, grade_number').order('grade_number'),
    admin
      .from('topics')
      .select('id, course_id, order_index, quarter, title, is_assessment')
      .order('order_index'),
    admin.from('homework_tasks').select('id, topic_id, points'),
    admin
      .from('topic_progress')
      .select('student_id, topic_id, completed, sim_correct_count'),
    admin.from('submissions').select('student_id, task_id, score'),
  ]);

  const emailMap = new Map<string, string>();
  for (const u of authUsersData?.users || []) {
    if (u.email) emailMap.set(u.id, u.email);
  }

  const students: StudentRow[] = (studentProfiles || []).map((p) => ({
    id: p.id,
    full_name: p.full_name || 'Ученик',
    email: emailMap.get(p.id) || '',
    classroom_id: p.classroom_id || null,
  }));

  const taskTopicMap = new Map<string, string>();
  const topicMaxPoints = new Map<string, number>();
  for (const task of taskRows || []) {
    taskTopicMap.set(task.id, task.topic_id);
    topicMaxPoints.set(
      task.topic_id,
      (topicMaxPoints.get(task.topic_id) || 0) + Number(task.points || 0)
    );
  }

  const topics: JournalTopic[] = (topicRows || []).map((t) => ({
    ...t,
    maxPoints: topicMaxPoints.get(t.id) || 0,
  }));

  const topicScores: TopicScoreEntry[] = [];
  for (const sub of submissionRows || []) {
    const topicId = taskTopicMap.get(sub.task_id);
    if (topicId) {
      topicScores.push({
        student_id: sub.student_id,
        topic_id: topicId,
        score: Number(sub.score || 0),
      });
    }
  }

  return (
    <JournalClient
      initialClassrooms={(classRows as ClassroomRow[]) || []}
      initialStudents={students}
      courses={(courseRows as JournalCourse[]) || []}
      topics={topics}
      progressList={(progressRows as ProgressEntry[]) || []}
      topicScores={topicScores}
    />
  );
}

export default function TeacherJournalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-500">
          Загрузка журнала...
        </div>
      }
    >
      <JournalContent />
    </Suspense>
  );
}