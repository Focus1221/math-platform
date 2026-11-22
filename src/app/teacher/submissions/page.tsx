import { Suspense } from 'react';
import { connection } from 'next/server';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import SubmissionsReviewClient, {
  type ReviewItem,
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
        <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-md text-center space-y-3">
          <h1 className="text-lg font-extrabold text-slate-900">Нужен вход в аккаунт</h1>
          <p className="text-xs text-slate-500">Сессия не найдена. Войди под аккаунтом учителя.</p>
          <Link
            href="/login"
            className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
          >
            Перейти ко входу
          </Link>
        </div>
      </div>
    );
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (profErr || profile?.role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-rose-200 p-8 max-w-md text-center space-y-3">
          <h1 className="text-lg font-extrabold text-slate-900">Нет прав учителя</h1>
          <p className="text-xs text-slate-600">
            Текущая роль: <strong>{profile?.role || 'не определена'}</strong>
            {profErr ? ` (${profErr.message})` : ''}
          </p>
          <Link
            href="/courses"
            className="inline-block px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
          >
            ← Вернуться к курсам
          </Link>
        </div>
      </div>
    );
  }

  const { data: rows, error: rowsErr } = await supabase
    .from('submissions')
    .select(
      `
      id,
      answer_text,
      photo_path,
      score,
      status,
      teacher_comment,
      updated_at,
      profiles ( full_name ),
      homework_tasks (
        type,
        question_md,
        points,
        topics (
          title,
          courses ( title )
        )
      )
    `
    )
    .order('updated_at', { ascending: false })
    .limit(100);

  if (rowsErr) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-rose-200 p-8 max-w-lg space-y-3">
          <h1 className="text-base font-extrabold text-rose-700">Ошибка загрузки журнала ДЗ</h1>
          <pre className="text-xs bg-rose-50 p-3 rounded-xl overflow-x-auto text-rose-900">
            {rowsErr.message}
          </pre>
          <Link
            href="/courses"
            className="inline-block px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
          >
            ← Вернуться к курсам
          </Link>
        </div>
      </div>
    );
  }

  const items: ReviewItem[] = [];

  for (const r of (rows as Record<string, unknown>[]) || []) {
    const rawProf = r.profiles;
    const prof = (Array.isArray(rawProf) ? rawProf[0] : rawProf) as {
      full_name?: string;
    } | null;

    const rawTask = r.homework_tasks;
    const task = (Array.isArray(rawTask) ? rawTask[0] : rawTask) as {
      type?: 'test' | 'input' | 'open';
      question_md?: string;
      points?: number;
      topics?:
        | { title?: string; courses?: { title?: string } | { title?: string }[] | null }
        | { title?: string; courses?: { title?: string } | { title?: string }[] | null }[]
        | null;
    } | null;

    const topic = Array.isArray(task?.topics) ? task?.topics[0] : task?.topics;
    const course = Array.isArray(topic?.courses) ? topic?.courses[0] : topic?.courses;

    let photoUrl: string | null = null;
    if (typeof r.photo_path === 'string' && r.photo_path) {
      const { data: signed } = await supabase.storage
        .from('student-submissions')
        .createSignedUrl(r.photo_path, 3600);
      photoUrl = signed?.signedUrl || null;
    }

    items.push({
      id: String(r.id),
      studentName: prof?.full_name || 'Ученик',
      courseTitle: course?.title || 'Курс',
      topicTitle: topic?.title || 'Урок',
      questionMd: task?.question_md || '',
      taskType: task?.type || 'open',
      maxPoints: Number(task?.points || 2),
      answerText: String(r.answer_text || ''),
      photoUrl,
      score: Number(r.score || 0),
      status: (r.status as ReviewItem['status']) || 'pending_review',
      teacherComment: String(r.teacher_comment || ''),
      updatedAt: String(r.updated_at || ''),
    });
  }

  return <SubmissionsReviewClient initialItems={items} />;
}

export default function TeacherSubmissionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-500">
          Загрузка журнала ДЗ...
        </div>
      }
    >
      <SubmissionsContent />
    </Suspense>
  );
}