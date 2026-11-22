import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import {
  buildBaseLogin,
  generatePinCode,
  studentLoginToEmail,
  studentPinToPassword,
} from '@/lib/auth/studentLogin';

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
    const classroomId = String(body.classroomId || '').trim();
    const rawNames = String(body.namesText || '');

    if (!classroomId) {
      return NextResponse.json({ error: 'Выберите класс для добавления учеников.' }, { status: 400 });
    }

    const { data: classroom } = await admin
      .from('classrooms')
      .select('id, name, grade_number')
      .eq('id', classroomId)
      .single();

    if (!classroom) {
      return NextResponse.json({ error: 'Класс не найден.' }, { status: 404 });
    }

    const names = rawNames
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*\d+[\.\)\-\s]+/, '').trim())
      .filter((line) => line.length >= 2)
      .slice(0, 45);

    if (names.length === 0) {
      return NextResponse.json(
        { error: 'Вставьте хотя бы одно имя ученика (каждый ученик с новой строки).' },
        { status: 400 }
      );
    }

    // Загружаем уже занятые логины, чтобы гарантировать уникальность
    const { data: existingCards } = await admin
      .from('student_access_cards')
      .select('login_username');

    const usedLogins = new Set<string>(
      (existingCards || []).map((c) => c.login_username.toLowerCase())
    );

    const created: {
      id: string;
      full_name: string;
      email: string;
      classroom_id: string;
      login_username: string;
      pin_code: string;
    }[] = [];
    const failed: { name: string; reason: string }[] = [];

    for (const fullName of names) {
      const base = buildBaseLogin(fullName, classroom.name);
      let login = base;
      let suffix = 2;
      while (usedLogins.has(login)) {
        login = `${base}${suffix}`;
        suffix++;
      }
      usedLogins.add(login);

      const pin = generatePinCode();
      const email = studentLoginToEmail(login);
      const password = studentPinToPassword(pin);

      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (authErr || !authData.user) {
        failed.push({ name: fullName, reason: authErr?.message || 'Ошибка создания' });
        continue;
      }

      const studentId = authData.user.id;

      await admin.from('profiles').upsert({
        id: studentId,
        full_name: fullName,
        role: 'student',
        grade_number: classroom.grade_number,
        class_name: classroom.name,
        classroom_id: classroom.id,
      });

      await admin.from('student_access_cards').upsert({
        student_id: studentId,
        classroom_id: classroom.id,
        login_username: login,
        pin_code: pin,
        updated_at: new Date().toISOString(),
      });

      created.push({
        id: studentId,
        full_name: fullName,
        email,
        classroom_id: classroom.id,
        login_username: login,
        pin_code: pin,
      });
    }

    return NextResponse.json({ created, failed });
  } catch (err) {
    console.error('bulk-students error:', err);
    return NextResponse.json(
      { error: 'Внутренняя ошибка при создании учеников.' },
      { status: 500 }
    );
  }
}