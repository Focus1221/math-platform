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

function generateJoinCode(grade: number) {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${grade}KL-${num}`;
}

export async function POST(request: Request) {
  const ctx = await requireTeacher();
  if (!ctx) return NextResponse.json({ error: 'Доступ только для учителя' }, { status: 403 });

  const body = await request.json();
  const name = String(body.name || '').trim();
  const gradeNumber = Number(body.gradeNumber || 5);
  const rawCode = String(body.joinCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');

  if (!name) {
    return NextResponse.json({ error: 'Укажите название класса (напр. 5 «А»)' }, { status: 400 });
  }

  const joinCode = rawCode || generateJoinCode(gradeNumber);

  const { data, error } = await ctx.admin
    .from('classrooms')
    .insert({
      name,
      grade_number: gradeNumber,
      join_code: joinCode,
      teacher_id: ctx.userId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.code === '23505' ? 'Такой код класса уже занят' : error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ classroom: data });
}

export async function PATCH(request: Request) {
  const ctx = await requireTeacher();
  if (!ctx) return NextResponse.json({ error: 'Доступ только для учителя' }, { status: 403 });

  const body = await request.json();
  const studentId = String(body.studentId || '');
  const classroomId = body.classroomId ? String(body.classroomId) : null;

  if (!studentId) {
    return NextResponse.json({ error: 'Не указан ученик' }, { status: 400 });
  }

  const { error } = await ctx.admin
    .from('profiles')
    .update({ classroom_id: classroomId })
    .eq('id', studentId)
    .eq('role', 'student');
    await ctx.admin.from('student_access_cards').update({ classroom_id: classroomId }).eq('student_id', studentId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const ctx = await requireTeacher();
  if (!ctx) return NextResponse.json({ error: 'Доступ только для учителя' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Не указан ID класса' }, { status: 400 });

  const { error } = await ctx.admin.from('classrooms').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}