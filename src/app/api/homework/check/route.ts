import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';

function normalizeAnswer(val: string): string {
  return val.trim().replace(/\s+/g, '').replace(/\./g, ',').toLowerCase();
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Нужно войти в аккаунт' }, { status: 401 });
    }

    const body = await request.json();
    const taskId = String(body.taskId || '');
    const answerText = String(body.answerText || '');
    const photoPath = body.photoPath ? String(body.photoPath) : null;

    if (!taskId) {
      return NextResponse.json({ error: 'Не указан ID задания' }, { status: 400 });
    }

    const admin = createAdminSupabase();

    const { data: task, error: taskErr } = await admin
      .from('homework_tasks')
      .select('id, type, points')
      .eq('id', taskId)
      .single();

    if (taskErr || !task) {
      return NextResponse.json({ error: 'Задание не найдено' }, { status: 404 });
    }

    // Развёрнутая задача отправляется на ручную проверку учителю
    if (task.type === 'open') {
      if (!answerText.trim() && !photoPath) {
        return NextResponse.json(
          { error: 'Напишите решение или прикрепите фото тетради' },
          { status: 400 }
        );
      }

      const { data: existing } = await admin
        .from('submissions')
        .select('photo_path')
        .eq('task_id', task.id)
        .eq('student_id', user.id)
        .maybeSingle();

      const { data: submission, error: subErr } = await admin
        .from('submissions')
        .upsert(
          {
            task_id: task.id,
            student_id: user.id,
            answer_text: answerText.trim(),
            photo_path: photoPath ?? existing?.photo_path ?? null,
            is_correct: null,
            score: 0,
            status: 'pending_review',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'task_id,student_id' }
        )
        .select()
        .single();

      if (subErr) {
        return NextResponse.json({ error: subErr.message }, { status: 500 });
      }

      return NextResponse.json({ submission, hint: '' });
    }

    // Автопроверка для test и input
    const { data: keyRow, error: keyErr } = await admin
      .from('homework_answer_keys')
      .select('correct_answer, solution_hint')
      .eq('task_id', task.id)
      .single();

    if (keyErr || !keyRow) {
      return NextResponse.json(
        { error: 'Для этого задания не задан ключ ответа' },
        { status: 500 }
      );
    }

    const isCorrect =
      normalizeAnswer(answerText) === normalizeAnswer(keyRow.correct_answer);
    const score = isCorrect ? task.points : 0;

    const { data: submission, error: subErr } = await admin
      .from('submissions')
      .upsert(
        {
          task_id: task.id,
          student_id: user.id,
          answer_text: answerText.trim(),
          is_correct: isCorrect,
          score,
          status: 'checked',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'task_id,student_id' }
      )
      .select()
      .single();

    if (subErr) {
      return NextResponse.json({ error: subErr.message }, { status: 500 });
    }

    return NextResponse.json({
      submission,
      hint: isCorrect ? '' : keyRow.solution_hint || '',
    });
  } catch (err) {
    console.error('homework/check error:', err);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}