import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { generatePinCode, studentPinToPassword } from '@/lib/auth/studentLogin';

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

    const { data: card } = await admin
      .from('student_access_cards')
      .select('student_id, login_username')
      .eq('student_id', studentId)
      .maybeSingle();

    if (card) {
      const newPin = generatePinCode();
      const { error } = await admin.auth.admin.updateUserById(studentId, {
        password: studentPinToPassword(newPin),
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await admin
        .from('student_access_cards')
        .update({ pin_code: newPin, updated_at: new Date().toISOString() })
        .eq('student_id', studentId);

      return NextResponse.json({
        ok: true,
        isPin: true,
        studentName: target.full_name,
        loginUsername: card.login_username,
        tempPassword: newPin,
      });
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
      isPin: false,
      studentName: target.full_name,
      tempPassword,
    });
  } catch (err) {
    console.error('reset-password error:', err);
    return NextResponse.json({ error: 'Ошибка сброса пароля' }, { status: 500 });
  }
}