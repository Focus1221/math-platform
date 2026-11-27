'use client';

import {
  PRACTICE_STAR_TARGET,
  type TopicStarProgress,
} from '@/lib/gamification';

interface Props {
  progress?: TopicStarProgress;
  onSelectStep?: (step: 'theory' | 'practice' | 'homework') => void;
}

export default function LessonStarsBar({ progress, onSelectStep }: Props) {
  const slidesDone = Boolean(progress?.slides_done);
  const practiceDone = Boolean(progress?.practice_done);
  const homeworkDone = Boolean(progress?.homework_done);
  const solvedCount = Math.min(
    PRACTICE_STAR_TARGET,
    Number(progress?.practice_solved || 0)
  );

  const earnedCount =
    (slidesDone ? 1 : 0) + (practiceDone ? 1 : 0) + (homeworkDone ? 1 : 0);

  const items: {
    key: 'theory' | 'practice' | 'homework';
    icon: string;
    label: string;
    done: boolean;
    sub: string;
  }[] = [
    {
      key: 'theory',
      icon: '📘',
      label: 'Слайды',
      done: slidesDone,
      sub: slidesDone ? 'Пройдено' : 'Дойди до конца',
    },
    {
      key: 'practice',
      icon: '🎮',
      label: 'Тренажёр',
      done: practiceDone,
      sub: practiceDone
        ? 'Зачтено'
        : `Решено ${solvedCount} из ${PRACTICE_STAR_TARGET}`,
    },
    {
      key: 'homework',
      icon: '✅',
      label: 'Домашка',
      done: homeworkDone,
      sub: homeworkDone ? 'Сдано' : 'Отправь ответы',
    },
  ];

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      <div className="grid grid-cols-3 gap-2 flex-1">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectStep?.(item.key)}
            className={`px-2.5 py-2 rounded-xl border text-left transition flex items-center gap-2 ${
              item.done
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-slate-50 border-slate-200 hover:border-indigo-300 text-slate-600'
            }`}
          >
            <span className="text-base leading-none shrink-0">
              {item.done ? '⭐' : item.icon}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-extrabold truncate">{item.label}</div>
              <div className="text-[10px] font-semibold opacity-75 truncate">
                {item.sub}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div
        className={`px-3 py-2 rounded-xl text-xs font-extrabold text-center shrink-0 ${
          earnedCount === 3
            ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-xs'
            : 'bg-slate-100 text-slate-600'
        }`}
      >
        {earnedCount === 3 ? '🏆 3 / 3 идеально!' : `⭐ ${earnedCount} / 3`}
      </div>
    </div>
  );
}