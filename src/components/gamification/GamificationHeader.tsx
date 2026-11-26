'use client';

import { useState } from 'react';
import {
  BADGES,
  getLevelInfo,
  pluralizeDays,
  type StudentGamificationStats,
} from '@/lib/gamification';
import { playSound } from '@/lib/audio/sound';

interface Props {
  stats: StudentGamificationStats | null;
  rewardBanner?: string | null;
}

export default function GamificationHeader({ stats, rewardBanner }: Props) {
  const [openBadges, setOpenBadges] = useState(false);

  if (!stats) return null;

  const level = getLevelInfo(stats.xp);
  const unlockedSet = new Set(stats.badges || []);

  return (
    <>
      <div className="rounded-2xl bg-white border border-slate-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        {/* Уровень и полоска XP */}
        <div className="flex items-center gap-3 min-w-[200px] flex-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs">
            Lv.{level.level}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
              <span className="text-slate-800 truncate">{level.title}</span>
              <span className="text-indigo-600 tabular-nums shrink-0">
                {stats.xp} XP
                {level.nextLevel ? ` / ${level.nextLevel.minXp}` : ' MAX'}
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-500"
                style={{ width: `${level.progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Стрик и кнопка наград */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 ${
              stats.streak_days > 0
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
            title={`Рекорд серии: ${pluralizeDays(stats.best_streak)}`}
          >
            <span>🔥</span>
            <span>
              {stats.streak_days > 0
                ? pluralizeDays(stats.streak_days)
                : 'Старт серии'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              playSound('click');
              setOpenBadges(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-extrabold transition flex items-center gap-1.5"
          >
            <span>🏅</span>
            <span>
              Награды ({unlockedSet.size}/{BADGES.length})
            </span>
          </button>
        </div>
      </div>

      {/* Всплывающий баннер при получении +XP или нового бейджа */}
      {rewardBanner && (
        <div className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white px-4 py-2.5 text-xs sm:text-sm font-extrabold text-center shadow-sm animate-pop">
          {rewardBanner}
        </div>
      )}

      {/* Модалка всех бейджей */}
      {openBadges && (
        <div
          onClick={() => setOpenBadges(false)}
          className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-pop"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  🏅 Мои достижения
                </h3>
                <p className="text-xs text-slate-500">
                  Открыто {unlockedSet.size} из {BADGES.length} · Рекорд серии:{' '}
                  {pluralizeDays(stats.best_streak)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenBadges(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-extrabold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {BADGES.map((badge) => {
                const unlocked = unlockedSet.has(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`p-3.5 rounded-2xl border-2 flex items-start gap-3 transition ${
                      unlocked
                        ? 'bg-amber-50/70 border-amber-300'
                        : 'bg-slate-50 border-slate-200 opacity-60 grayscale'
                    }`}
                  >
                    <div className="text-2xl leading-none mt-0.5">{badge.icon}</div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900">
                        {badge.title}
                      </div>
                      <div className="text-[11px] text-slate-600 leading-snug mt-0.5">
                        {badge.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}