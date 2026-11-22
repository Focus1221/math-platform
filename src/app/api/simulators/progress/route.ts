import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Гости могут тренироваться без сохранения в БД
    if (!user) {
      return NextResponse.json({ ok: true, guest: true });
    }

    const body = await request.json();
    const simId = String(body.simId || 'generator').trim();
    const isCorrect = Boolean(body.isCorrect);

    const admin = createAdminSupabase();

    // Ищем тему с подходящим симулятором (или первую тему курса как запасной вариант)
    const targetSimType = simId === 'generator' ? 'arithmetic' : simId;
    let { data: topic } = await admin
      .from('topics')
      .select('id')
      .eq('sim_type', targetSimType)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!topic) {
      const { data: fallback } = await admin
        .from('topics')
        .select('id')
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle();
      topic = fallback;
    }

    if (!topic) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const { data: existing } = await admin
      .from('topic_progress')
      .select('completed, sim_correct_count, sim_streak')
      .eq('student_id', user.id)
      .eq('topic_id', topic.id)
      .maybeSingle();

    const nextCorrect = Number(existing?.sim_correct_count || 0) + (isCorrect ? 1 : 0);
    const nextStreak = isCorrect ? Number(existing?.sim_streak || 0) + 1 : 0;

    const { error } = await admin.from('topic_progress').upsert({
      student_id: user.id,
      topic_id: topic.id,
      completed: Boolean(existing?.completed),
      sim_correct_count: nextCorrect,
      sim_streak: nextStreak,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, nextCorrect, nextStreak });
  } catch (err) {
    console.error('simulators/progress error:', err);
    return NextResponse.json({ error: 'Ошибка сохранения прогресса' }, { status: 500 });
  }
}