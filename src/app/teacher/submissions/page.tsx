import { Suspense } from 'react';
import { connection } from 'next/server';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import SubmissionsReviewClient, {
  type ReviewClassroom,
  type ReviewSubmissionItem,
} from '@/components/teacher/SubmissionsReviewClient';

async function SubmissionsContent() {
  await connection();
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Link
          href="/login"
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
        >
          Войти в аккаунт учителя
        </Link>
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
        <div className="bg-white rounded-3xl border border-rose-200 p-8 text-center text-sm font-bold">
          Доступ только для учителя
        </div>
      </div>
    );
  }

  const [
    { data: classroomsData },
    { data: profilesData },
    { data: topicsData },
    { data: tasksData },
    { data: subsData },
  ] = await Promise.all([
    admin.from('classrooms').select('id, name').order('name'),
    admin.from('profiles').select('id, full_name, classroom_id'),
    admin.from('topics').select('id, title, order_index'),
    admin.from('homework_tasks').select('id, topic_id, question_md, points, type'),
    admin
      .from('submissions')
      .select(
        'id, student_id, task_id, answer_text, photo_path, status, score, teacher_comment, updated_at'
      )
      .in('status', ['pending_review', 'graded'])
      .order('updated_at', { ascending: false })
      .limit(150),
  ]);

  const classMap = new Map(
    (classroomsData || []).map((c) => [c.id, c.name])
  );
  const profileMap = new Map(
    (profilesData || []).map((p) => [p.id, p])
  );
  const topicMap = new Map(
    (topicsData || []).map((t) => [t.id, t])
  );
  const taskMap = new Map(
    (tasksData || []).map((t) => [t.id, t])
  );

  const items: ReviewSubmissionItem[] = [];

  for (const sub of subsData || []) {
    const task = taskMap.get(sub.task_id);
    if (!task) continue;
    const topic = topicMap.get(task.topic_id);
    const prof = profileMap.get(sub.student_id);

    let photoUrl: string | null = null;
    if (sub.photo_path) {
      const { data: signed } = await admin.storage
        .from('student-submissions')
        .createSignedUrl(sub.photo_path, 3600);
      photoUrl = signed?.signedUrl || null;
    }

    items.push({
      id: sub.id,
      studentId: sub.student_id,
      studentName: prof?.full_name || 'Ученик',
      classroomId: prof?.classroom_id || null,
      classroomName: prof?.classroom_id
        ? classMap.get(prof.classroom_id) || null
        : null,
      topicTitle: topic?.title || 'Урок',
      topicOrder: topic?.order_index || 0,
      questionMd: task.question_md || '',
      maxPoints: Number(task.points || 2),
      answerText: sub.answer_text || '',
      photoUrl,
      status: sub.status,
      score: Number(sub.score || 0),
      teacherComment: sub.teacher_comment || '',
      updatedAt: sub.updated_at || new Date().toISOString(),
    });
  }

  return (
    <SubmissionsReviewClient
      classrooms={(classroomsData as ReviewClassroom[]) || []}
      initialItems={items}
    />
  );
}

export default function TeacherSubmissionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-500">
          Загрузка работ на проверку...
        </div>
      }
    >
      <SubmissionsContent />
    </Suspense>
  );
}