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
      return NextResponse.json({ error: 'Нужен вход в аккаунт' }, { status: 401 });
    }

    const admin = createAdminSupabase();
    const { data: me } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (me?.role !== 'teacher') {
      return NextResponse.json({ error: 'Доступ только для учителя' }, { status: 403 });
    }

    const body = await request.json();
    const submissionId = String(body.submissionId || '').trim();
    const score = Math.max(0, Number(body.score) || 0);
    const teacherComment = String(body.teacherComment || '').trim();

    if (!submissionId) {
      return NextResponse.json({ error: 'Не указана работа' }, { status: 400 });
    }

    const { error } = await admin
      .from('submissions')
      .update({
        score,
        teacher_comment: teacherComment,
        status: 'graded',
        is_correct: score > 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('grade-submission error:', err);
    return NextResponse.json({ error: 'Ошибка сохранения оценки' }, { status: 500 });
  }
}