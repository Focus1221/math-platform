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
    const { data: caller } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (caller?.role !== 'teacher') {
      return NextResponse.json({ error: 'Доступ только для учителя' }, { status: 403 });
    }

    const body = await request.json();
    const studentId = String(body.studentId || '');

    if (!studentId) {
      return NextResponse.json({ error: 'Не указан ID ученика' }, { status: 400 });
    }

    // Защита: сбрасываем пароль только аккаунтам с ролью student
    const { data: target } = await admin
      .from('profiles')
      .select('role, full_name')
      .eq('id', studentId)
      .single();

    if (!target || target.role !== 'student') {
      return NextResponse.json(
        { error: 'Можно сбрасывать пароль только ученикам.' },
        { status: 403 }
      );
    }

    const tempPassword = `math-${Math.floor(1000 + Math.random() * 9000)}`;
    const { error } = await admin.auth.admin.updateUserById(studentId, {
      password: tempPassword,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      studentName: target.full_name,
      tempPassword,
    });
  } catch (err) {
    console.error('reset-password error:', err);
    return NextResponse.json({ error: 'Ошибка сброса пароля' }, { status: 500 });
  }
}