'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { playSound } from '@/lib/audio/sound';
import type {
  BadgeDef,
  StudentGamificationStats,
  TopicStarProgress,
} from '@/lib/gamification';

type ActionType = 'slides_done' | 'practice_solved' | 'homework_done';

export function useGamification(enabled = true) {
  const [stats, setStats] = useState<StudentGamificationStats | null>(null);
  const [starsMap, setStarsMap] = useState<Record<string, TopicStarProgress>>({});
  const [rewardBanner, setRewardBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = useCallback((message: string) => {
    setRewardBanner(message);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setRewardBanner(null);
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/student/gamification', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.stats) setStats(data.stats);
        if (data.starsMap) setStarsMap(data.starsMap);
      } catch (err) {
        console.error('load gamification error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const recordAction = useCallback(
    async (
      topicId: string,
      action: ActionType,
      extra?: { solvedDelta?: number; solvedTotal?: number }
    ) => {
      if (!enabled || !topicId) return;

      const current = starsMap[topicId];
      if (action === 'slides_done' && current?.slides_done) return;
      if (action === 'homework_done' && current?.homework_done) return;

      try {
        const res = await fetch('/api/student/gamification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topicId,
            action,
            ...extra,
          }),
        });
        if (!res.ok) return;

        const data = (await res.json()) as {
          stats?: StudentGamificationStats;
          topicStars?: TopicStarProgress;
          awardedXp?: number;
          newBadges?: BadgeDef[];
        };

        if (data.stats) setStats(data.stats);
        if (data.topicStars) {
          setStarsMap((prev) => ({
            ...prev,
            [topicId]: data.topicStars!,
          }));
        }

        const xpGain = Number(data.awardedXp || 0);
        const badges = Array.isArray(data.newBadges) ? data.newBadges : [];

        if (xpGain > 0 || badges.length > 0) {
          playSound('celebrate');
          const parts: string[] = [];
          if (xpGain > 0) parts.push(`+${xpGain} XP`);
          if (badges.length > 0) {
            parts.push(
              `Новая награда: ${badges.map((b) => `${b.icon} ${b.title}`).join(', ')}`
            );
          }
          showBanner(`🎉 ${parts.join(' · ')}`);
        }
      } catch (err) {
        console.error('recordAction error:', err);
      }
    },
    [enabled, starsMap, showBanner]
  );

  const markSlidesDone = useCallback(
    (topicId: string) => recordAction(topicId, 'slides_done'),
    [recordAction]
  );

  const reportPracticeSolved = useCallback(
    (topicId: string, solvedTotal?: number) =>
      recordAction(
        topicId,
        'practice_solved',
        solvedTotal !== undefined ? { solvedTotal } : { solvedDelta: 1 }
      ),
    [recordAction]
  );

  const markHomeworkDone = useCallback(
    (topicId: string) => recordAction(topicId, 'homework_done'),
    [recordAction]
  );

  return {
    stats,
    starsMap,
    rewardBanner,
    loading,
    markSlidesDone,
    reportPracticeSolved,
    markHomeworkDone,
  };
}