import { Suspense } from 'react';
import { connection } from 'next/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import PrintCardsClient, {
  type PrintableCard,
} from '@/components/teacher/PrintCardsClient';

async function CardsContent({
  params,
}: {
  params: Promise<{ classroomId: string }>;
}) {
  await connection();
  const { classroomId } = await params;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Link
          href="/login"
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
        >
          Войти в аккаунт учителя
        </Link>
      </div>
    );
  }

  const admin = createAdminSupabase();
  const { data: me } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (me?.role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-rose-200 p-8 text-center text-sm font-bold">
          Доступ только для учителя
        </div>
      </div>
    );
  }

  const { data: classroom } = await admin
    .from('classrooms')
    .select('id, name')
    .eq('id', classroomId)
    .single();

  if (!classroom) notFound();

  const [{ data: profiles }, { data: accessCards }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name')
      .eq('classroom_id', classroom.id)
      .eq('role', 'student')
      .order('full_name'),
    admin
      .from('student_access_cards')
      .select('student_id, login_username, pin_code')
      .eq('classroom_id', classroom.id),
  ]);

  const cardMap = new Map(
    (accessCards || []).map((c) => [c.student_id, c])
  );

  const cards: PrintableCard[] = [];
  for (const p of profiles || []) {
    const c = cardMap.get(p.id);
    if (c) {
      cards.push({
        studentId: p.id,
        fullName: p.full_name || 'Ученик',
        loginUsername: c.login_username,
        pinCode: c.pin_code,
      });
    }
  }

  return <PrintCardsClient classroomName={classroom.name} cards={cards} />;
}

export default function TeacherCardsPage({
  params,
}: {
  params: Promise<{ classroomId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-500">
          Подготавливаем карточки для печати...
        </div>
      }
    >
      <CardsContent params={params} />
    </Suspense>
  );
}