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
  const { data: me } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (me?.role !== 'teacher') return null;
  return { admin };
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireTeacher();
    if (!ctx) {
      return NextResponse.json({ error: 'Доступ только для учителя' }, { status: 403 });
    }

    const body = await request.json();
    const studentId = String(body.studentId || '').trim();
    const fullName = String(body.fullName || '').trim();

    if (!studentId || fullName.length < 2) {
      return NextResponse.json(
        { error: 'Укажите корректное имя ученика (минимум 2 символа).' },
        { status: 400 }
      );
    }

    const { data: target } = await ctx.admin
      .from('profiles')
      .select('role')
      .eq('id', studentId)
      .single();

    if (!target || target.role !== 'student') {
      return NextResponse.json(
        { error: 'Редактировать можно только аккаунты учеников.' },
        { status: 403 }
      );
    }

    const [{ error: profErr }] = await Promise.all([
      ctx.admin
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', studentId),
      ctx.admin.auth.admin.updateUserById(studentId, {
        user_metadata: { full_name: fullName },
      }),
    ]);

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, fullName });
  } catch (err) {
    console.error('teacher/students PATCH error:', err);
    return NextResponse.json({ error: 'Ошибка переименования' }, { status: 500 });
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
    if (!id) {
      return NextResponse.json({ error: 'Не указан ID ученика' }, { status: 400 });
    }

    const { data: target } = await ctx.admin
      .from('profiles')
      .select('role')
      .eq('id', id)
      .single();

    if (!target || target.role !== 'student') {
      return NextResponse.json(
        { error: 'Удалять можно только аккаунты учеников.' },
        { status: 403 }
      );
    }

    // Удаление из auth.users каскадно очищает профиль, карточку PIN, прогресс и сдачи ДЗ
    const { error } = await ctx.admin.auth.admin.deleteUser(id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('teacher/students DELETE error:', err);
    return NextResponse.json({ error: 'Ошибка удаления ученика' }, { status: 500 });
  }
}