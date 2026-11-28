'use client';

import { useEffect, useRef, useState } from 'react';
import AppNav from '@/components/layout/AppNav';
import GamificationHeader from '@/components/gamification/GamificationHeader';
import CoordRaySim from '@/components/simulators/CoordRaySim';
import DivisibilitySim from '@/components/simulators/DivisibilitySim';
import FractionsSim from '@/components/simulators/FractionsSim';
import ProtractorSim from '@/components/simulators/ProtractorSim';
import SetsVennSim from '@/components/simulators/SetsVennSim';
import PercentGridSim from '@/components/simulators/PercentGridSim';
import DiagramsSim from '@/components/simulators/DiagramsSim';
import TaskGeneratorSim from '@/components/simulators/TaskGeneratorSim';
import { useGamification } from '@/hooks/useGamification';
import { playSound } from '@/lib/audio/sound';
import type { Profile } from '@/types/db';

type SimId =
  | 'coord_ray'
  | 'divisibility'
  | 'fractions_visual'
  | 'angles'
  | 'sets'
  | 'percent_grid'
  | 'diagrams'
  | 'generator';

const SIM_LIST: { id: SimId; icon: string; name: string; sub: string }[] = [
  { id: 'coord_ray', icon: '📏', name: 'Координатный луч', sub: 'Точки и неравенства' },
  { id: 'divisibility', icon: '⚡', name: 'Блиц: Делимость', sub: 'Признаки на 2, 3, 5, 9, 10' },
  { id: 'fractions_visual', icon: '🍕', name: 'Пицца дробей', sub: 'Доли и сравнение' },
  { id: 'angles', icon: '📐', name: 'Транспортир', sub: 'Измерь и построй угол' },
  { id: 'sets', icon: '⭕', name: 'Эйлер–Венн', sub: 'Пересечение и объединение' },
  { id: 'percent_grid', icon: '💯', name: 'Проценты 10×10', sub: 'Сетка и перевод в дроби' },
  { id: 'diagrams', icon: '📊', name: 'Диаграммы', sub: 'Круговые и столбчатые' },
  { id: 'generator', icon: '🎲', name: 'Генератор задач', sub: 'Счёт, уравнения, проценты' },
];

function resolveInitialSim(raw?: string): SimId {
  const valid = SIM_LIST.map((s) => s.id);
  return raw && valid.includes(raw as SimId) ? (raw as SimId) : 'fractions_visual';
}

interface Props {
  profile: Profile | null;
  initialSim?: string;
  initialSolved?: number;
}

export default function SimulatorsLabClient({
  profile,
  initialSim,
  initialSolved = 0,
}: Props) {
  const [activeSim, setActiveSim] = useState<SimId>(() =>
    resolveInitialSim(initialSim)
  );
  const [solved, setSolved] = useState(initialSolved);
  const [streak, setStreak] = useState(0);
  const [milestoneBanner, setMilestoneBanner] = useState('');

  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { stats, rewardBanner, reportPracticeSolved } = useGamification(
    Boolean(profile)
  );

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  function handleResult(isCorrect: boolean) {
    if (isCorrect) {
      const nextSolved = solved + 1;
      const nextStreak = streak + 1;
      setSolved(nextSolved);
      setStreak(nextStreak);

      if (nextStreak % 5 === 0) {
        playSound('celebrate');
        setMilestoneBanner(`🔥 Огонь! Серия ${nextStreak} верных ответов подряд!`);
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = setTimeout(() => setMilestoneBanner(''), 3000);
      } else {
        playSound('success');
      }
    } else {
      setStreak(0);
      playSound('error');
    }

    if (profile) {
      fetch('/api/simulators/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simId: activeSim, isCorrect }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isCorrect && data?.topicId) {
            reportPracticeSolved(data.topicId, data.nextCorrect);
          }
        })
        .catch(() => {});
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav profile={profile} />

      <main className="max-w-5xl w-full mx-auto px-4 pt-6 pb-24 md:pb-10 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              🎮 Лаборатория тренажёров
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Выбери любой тренажёр и тренируйся в своём темпе без оценок и стресса.
            </p>
          </div>

          <div className="flex items-center gap-2.5 bg-white border border-slate-200 px-4 py-2 rounded-2xl shadow-xs text-xs sm:text-sm font-bold tabular-nums">
            <span className="text-emerald-700">🏆 Решено: {solved}</span>
            <span className="text-slate-200">|</span>
            <span className="text-amber-600">🔥 Серия: {streak}</span>
          </div>
        </div>

        {profile && (
          <GamificationHeader stats={stats} rewardBanner={rewardBanner} />
        )}

        {milestoneBanner && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-100 to-emerald-100 border border-emerald-300 text-center text-sm font-extrabold text-emerald-950 animate-pop">
            {milestoneBanner}
          </div>
        )}

        {/* Выбор симулятора */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {SIM_LIST.map((s) => {
            const active = activeSim === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  playSound('click');
                  setActiveSim(s.id);
                }}
                className={`text-left p-3.5 rounded-2xl border-2 transition flex items-start gap-2.5 ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300'
                }`}
              >
                <span className="text-xl leading-none mt-0.5">{s.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold truncate">{s.name}</div>
                  <div
                    className={`text-[10px] mt-0.5 truncate ${
                      active ? 'text-indigo-100' : 'text-slate-400'
                    }`}
                  >
                    {s.sub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Игровое поле */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-4 sm:p-6">
          {activeSim === 'coord_ray' && <CoordRaySim onResult={handleResult} />}
          {activeSim === 'divisibility' && <DivisibilitySim onResult={handleResult} />}
          {activeSim === 'fractions_visual' && <FractionsSim onResult={handleResult} />}
          {activeSim === 'angles' && <ProtractorSim onResult={handleResult} />}
          {activeSim === 'sets' && <SetsVennSim onResult={handleResult} />}
          {activeSim === 'percent_grid' && <PercentGridSim onResult={handleResult} />}
          {activeSim === 'diagrams' && <DiagramsSim onResult={handleResult} />}
          {activeSim === 'generator' && (
            <TaskGeneratorSim initialSimType="arithmetic" onResult={handleResult} />
          )}
        </div>
      </main>
    </div>
  );
}