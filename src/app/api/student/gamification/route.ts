import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import {
  BADGES,
  PRACTICE_STAR_TARGET,
  XP_REWARDS,
  getAlmatyDateStr,
  getYesterdayAlmatyDateStr,
  type StudentGamificationStats,
  type TopicStarProgress,
} from '@/lib/gamification';

type GamificationAction = 'slides_done' | 'practice_solved' | 'homework_done';

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Нужен вход в аккаунт' }, { status: 401 });
    }

    const admin = createAdminSupabase();
    const [{ data: profile }, { data: rows }] = await Promise.all([
      admin
        .from('profiles')
        .select('xp, streak_days, best_streak, last_active_date, badges')
        .eq('id', user.id)
        .single(),
      admin
        .from('lesson_stars')
        .select('topic_id, slides_done, practice_done, practice_solved, homework_done')
        .eq('user_id', user.id),
    ]);

    const today = getAlmatyDateStr();
    const yesterday = getYesterdayAlmatyDateStr();
    const lastActive = profile?.last_active_date
      ? String(profile.last_active_date).slice(0, 10)
      : null;

    // Если последний раз заходил раньше вчерашнего дня — текущий стрик обнулился
    const liveStreak =
      lastActive === today || lastActive === yesterday
        ? Number(profile?.streak_days || 0)
        : 0;

    const stats: StudentGamificationStats = {
      xp: Number(profile?.xp || 0),
      streak_days: liveStreak,
      best_streak: Number(profile?.best_streak || 0),
      last_active_date: lastActive,
      badges: Array.isArray(profile?.badges) ? profile.badges : [],
    };

    const starsMap: Record<string, TopicStarProgress> = {};
    for (const r of rows || []) {
      const tid = String(r.topic_id);
      starsMap[tid] = {
        topic_id: tid,
        slides_done: Boolean(r.slides_done),
        practice_done: Boolean(r.practice_done),
        practice_solved: Number(r.practice_solved || 0),
        homework_done: Boolean(r.homework_done),
      };
    }

    return NextResponse.json({ stats, starsMap });
  } catch (err) {
    console.error('GET /api/student/gamification error:', err);
    return NextResponse.json(
      { error: 'Не удалось загрузить прогресс' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Нужен вход в аккаунт' }, { status: 401 });
    }

    const body = await request.json();
    const topicId = String(body.topicId || '').trim();
    const action = body.action as GamificationAction;
    const solvedDelta = Math.max(0, Math.min(10, Number(body.solvedDelta ?? 1)));
    const solvedTotal =
      body.solvedTotal !== undefined
        ? Math.max(0, Math.min(100, Number(body.solvedTotal)))
        : undefined;

    if (
      !topicId ||
      !['slides_done', 'practice_solved', 'homework_done'].includes(action)
    ) {
      return NextResponse.json(
        { error: 'Некорректные параметры прогресса' },
        { status: 400 }
      );
    }

    const admin = createAdminSupabase();

    const [{ data: existing }, { data: profile }] = await Promise.all([
      admin
        .from('lesson_stars')
        .select('topic_id, slides_done, practice_done, practice_solved, homework_done')
        .eq('user_id', user.id)
        .eq('topic_id', topicId)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('xp, streak_days, best_streak, last_active_date, badges')
        .eq('id', user.id)
        .single(),
    ]);

    const prev: TopicStarProgress = {
      topic_id: topicId,
      slides_done: Boolean(existing?.slides_done),
      practice_done: Boolean(existing?.practice_done),
      practice_solved: Number(existing?.practice_solved || 0),
      homework_done: Boolean(existing?.homework_done),
    };

    const next: TopicStarProgress = { ...prev };
    let awardedXp = 0;

    if (action === 'slides_done' && !prev.slides_done) {
      next.slides_done = true;
      awardedXp += XP_REWARDS.slides_done;
    }

    if (action === 'practice_solved') {
      const updatedSolved =
        solvedTotal !== undefined
          ? Math.max(prev.practice_solved, solvedTotal)
          : prev.practice_solved + solvedDelta;
      next.practice_solved = updatedSolved;

      if (!prev.practice_done && updatedSolved >= PRACTICE_STAR_TARGET) {
        next.practice_done = true;
        awardedXp += XP_REWARDS.practice_done;
      }
    }

    if (action === 'homework_done' && !prev.homework_done) {
      next.homework_done = true;
      awardedXp += XP_REWARDS.homework_done;
    }

    const wasPerfect = prev.slides_done && prev.practice_done && prev.homework_done;
    const isPerfect = next.slides_done && next.practice_done && next.homework_done;
    if (!wasPerfect && isPerfect) {
      awardedXp += XP_REWARDS.perfect_lesson_bonus;
    }

    const { error: upsertErr } = await admin.from('lesson_stars').upsert(
      {
        user_id: user.id,
        topic_id: topicId,
        slides_done: next.slides_done,
        practice_done: next.practice_done,
        practice_solved: next.practice_solved,
        homework_done: next.homework_done,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,topic_id' }
    );

    if (upsertErr) {
      console.error('lesson_stars upsert error:', upsertErr);
      return NextResponse.json(
        { error: 'Не удалось сохранить звёзды урока' },
        { status: 500 }
      );
    }

    // Обновляем серию дней (стрик) по часовому поясу Казахстана
    const today = getAlmatyDateStr();
    const yesterday = getYesterdayAlmatyDateStr();
    const lastActive = profile?.last_active_date
      ? String(profile.last_active_date).slice(0, 10)
      : null;

    let nextStreak = Number(profile?.streak_days || 0);
    if (lastActive === today) {
      nextStreak = Math.max(1, nextStreak);
    } else if (lastActive === yesterday) {
      nextStreak = nextStreak + 1;
    } else {
      nextStreak = 1;
    }

    const nextBestStreak = Math.max(Number(profile?.best_streak || 0), nextStreak);
    const nextXp = Number(profile?.xp || 0) + awardedXp;

    // Считаем все достижения ученика
    const { data: allRows } = await admin
      .from('lesson_stars')
      .select('slides_done, practice_done, practice_solved, homework_done')
      .eq('user_id', user.id);

    const rows = allRows || [];
    const totalStars = rows.reduce(
      (acc, r) =>
        acc +
        (r.slides_done ? 1 : 0) +
        (r.practice_done ? 1 : 0) +
        (r.homework_done ? 1 : 0),
      0
    );
    const perfectLessons = rows.filter(
      (r) => r.slides_done && r.practice_done && r.homework_done
    ).length;
    const totalSlidesDone = rows.filter((r) => r.slides_done).length;
    const totalPracticeSolved = rows.reduce(
      (acc, r) => acc + Number(r.practice_solved || 0),
      0
    );

    const prevBadges = new Set<string>(
      Array.isArray(profile?.badges) ? profile.badges : []
    );
    const nextBadges = new Set<string>(prevBadges);

    if (totalStars >= 1) nextBadges.add('first_star');
    if (perfectLessons >= 1) nextBadges.add('perfect_lesson');
    if (totalPracticeSolved >= 15) nextBadges.add('practice_fan');
    if (totalSlidesDone >= 5) nextBadges.add('slides_reader');
    if (nextStreak >= 3) nextBadges.add('streak_3');
    if (nextStreak >= 7) nextBadges.add('streak_7');
    if (nextXp >= 500) nextBadges.add('xp_500');
    if (perfectLessons >= 5) nextBadges.add('lessons_5_perfect');

    const newBadgeIds = Array.from(nextBadges).filter((b) => !prevBadges.has(b));
    const newBadges = BADGES.filter((b) => newBadgeIds.includes(b.id));

    await admin
      .from('profiles')
      .update({
        xp: nextXp,
        streak_days: nextStreak,
        best_streak: nextBestStreak,
        last_active_date: today,
        badges: Array.from(nextBadges),
      })
      .eq('id', user.id);

    const stats: StudentGamificationStats = {
      xp: nextXp,
      streak_days: nextStreak,
      best_streak: nextBestStreak,
      last_active_date: today,
      badges: Array.from(nextBadges),
    };

    return NextResponse.json({
      stats,
      topicStars: next,
      awardedXp,
      newBadges,
    });
  } catch (err) {
    console.error('POST /api/student/gamification error:', err);
    return NextResponse.json(
      { error: 'Ошибка сохранения прогресса' },
      { status: 500 }
    );
  }
}