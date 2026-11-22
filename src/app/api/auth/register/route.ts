import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fullName = String(body.fullName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = body.role === 'teacher' ? 'teacher' : 'student';
    const inviteCode = String(body.inviteCode || '').trim();

    if (!fullName || !email || password.length < 6) {
      return NextResponse.json(
        { error: 'Заполните имя, email и пароль (минимум 6 символов).' },
        { status: 400 }
      );
    }

    if (role === 'teacher') {
      const secret = process.env.TEACHER_INVITE_CODE;
      if (!secret) {
        return NextResponse.json(
          { error: 'На сервере не настроен код приглашения для учителей.' },
          { status: 500 }
        );
      }
      if (inviteCode !== secret) {
        return NextResponse.json(
          { error: 'Неверный код приглашения учителя.' },
          { status: 403 }
        );
      }
    }

    const admin = createAdminSupabase();

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || 'Не удалось создать аккаунт.' },
        { status: 400 }
      );
    }

    const { error: profErr } = await admin.from('profiles').upsert({
      id: data.user.id,
      full_name: fullName,
      role,
    });

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, role });
  } catch (err) {
    console.error('auth/register error:', err);
    return NextResponse.json(
      { error: 'Внутренняя ошибка при регистрации.' },
      { status: 500 }
    );
  }
}