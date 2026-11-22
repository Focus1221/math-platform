import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';

async function requireTeacher() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminSupabase();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'teacher') return null;
  return { userId: user.id, admin };
}

export async function POST(request: Request) {
  try {
    const ctx = await requireTeacher();
    if (!ctx) {
      return NextResponse.json({ error: 'Доступ только для учителя' }, { status: 403 });
    }

    const body = await request.json();
    const classroomId = String(body.classroomId || '');
    const topicId = String(body.topicId || '');
    const lessonDate = String(body.lessonDate || '').trim();
    const hwDueDate = body.hwDueDate ? String(body.hwDueDate).trim() : null;
    const note = String(body.note || '').trim();

    if (!classroomId || !topicId || !/^\d{4}-\d{2}-\d{2}$/.test(lessonDate)) {
      return NextResponse.json(
        { error: 'Укажите класс, тему и корректную дату урока.' },
        { status: 400 }
      );
    }

    if (hwDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(hwDueDate)) {
      return NextResponse.json(
        { error: 'Некорректная дата сдачи ДЗ.' },
        { status: 400 }
      );
    }

    const { data, error } = await ctx.admin
      .from('class_schedule')
      .upsert(
        {
          classroom_id: classroomId,
          topic_id: topicId,
          lesson_date: lessonDate,
          hw_due_date: hwDueDate,
          note,
        },
        { onConflict: 'classroom_id,topic_id' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data });
  } catch (err) {
    console.error('teacher/schedule POST error:', err);
    return NextResponse.json({ error: 'Ошибка сохранения расписания' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireTeacher();
    if (!ctx) {
      return NextResponse.json({ error: 'Доступ только для учителя' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const classroomId = searchParams.get('classroomId');
    const topicId = searchParams.get('topicId');

    if (id) {
      const { error } = await ctx.admin.from('class_schedule').delete().eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (classroomId && topicId) {
      const { error } = await ctx.admin
        .from('class_schedule')
        .delete()
        .eq('classroom_id', classroomId)
        .eq('topic_id', topicId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Не указаны параметры удаления' }, { status: 400 });
  } catch (err) {
    console.error('teacher/schedule DELETE error:', err);
    return NextResponse.json({ error: 'Ошибка удаления из расписания' }, { status: 500 });
  }
}