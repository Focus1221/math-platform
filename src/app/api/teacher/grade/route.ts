import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const admin = createAdminSupabase();
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'teacher') {
      return NextResponse.json({ error: 'Доступ только для учителя' }, { status: 403 });
    }

    const body = await request.json();
    const submissionId = String(body.submissionId || '');
    const score = Math.max(0, Number(body.score || 0));
    const teacherComment = String(body.teacherComment || '').trim();

    if (!submissionId) {
      return NextResponse.json({ error: 'Не указан ID работы' }, { status: 400 });
    }

    const { data: updated, error } = await admin
      .from('submissions')
      .update({
        score,
        is_correct: score > 0,
        status: 'graded',
        teacher_comment: teacherComment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ submission: updated });
  } catch (err) {
    console.error('teacher/grade error:', err);
    return NextResponse.json({ error: 'Ошибка сохранения оценки' }, { status: 500 });
  }
}