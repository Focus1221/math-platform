export const PRACTICE_STAR_TARGET = 3;

export const XP_REWARDS = {
  slides_done: 25,
  practice_done: 35,
  homework_done: 50,
  perfect_lesson_bonus: 20,
} as const;

export interface TopicStarProgress {
  topic_id: string;
  slides_done: boolean;
  practice_done: boolean;
  practice_solved: number;
  homework_done: boolean;
}

export interface StudentGamificationStats {
  xp: number;
  streak_days: number;
  best_streak: number;
  last_active_date: string | null;
  badges: string[];
}

export interface BadgeDef {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export const BADGES: BadgeDef[] = [
  {
    id: 'first_star',
    icon: '🌟',
    title: 'Первая звезда',
    description: 'Зажги первую звезду в любом уроке',
  },
  {
    id: 'perfect_lesson',
    icon: '🏆',
    title: 'Идеальный урок',
    description: 'Собери все 3 звезды в одном уроке',
  },
  {
    id: 'practice_fan',
    icon: '🎮',
    title: 'Мастер тренажёра',
    description: 'Реши 15 примеров в интерактивных тренажёрах',
  },
  {
    id: 'slides_reader',
    icon: '📘',
    title: 'Знаток теории',
    description: 'Пройди презентации в 5 разных уроках',
  },
  {
    id: 'streak_3',
    icon: '🔥',
    title: 'Разгон: 3 дня',
    description: 'Занимайся 3 дня подряд без пропусков',
  },
  {
    id: 'streak_7',
    icon: '⚡',
    title: 'Неделя силы',
    description: 'Держи серию 7 дней подряд',
  },
  {
    id: 'xp_500',
    icon: '💎',
    title: 'Клуб 500 XP',
    description: 'Набери 500 очков опыта',
  },
  {
    id: 'lessons_5_perfect',
    icon: '👑',
    title: 'Звёздная коллекция',
    description: 'Собери 3 из 3 звёзд в 5 уроках',
  },
];

export const LEVELS = [
  { level: 1, title: 'Новичок', minXp: 0 },
  { level: 2, title: 'Искатель', minXp: 100 },
  { level: 3, title: 'Следопыт', minXp: 250 },
  { level: 4, title: 'Знаток', minXp: 500 },
  { level: 5, title: 'Мастер формул', minXp: 850 },
  { level: 6, title: 'Чемпион', minXp: 1300 },
  { level: 7, title: 'Профессор', minXp: 2000 },
];

export function getLevelInfo(xp: number) {
  const safeXp = Math.max(0, Number(xp) || 0);
  let current = LEVELS[0];
  let next: (typeof LEVELS)[number] | null = LEVELS[1];

  for (let i = 0; i < LEVELS.length; i++) {
    if (safeXp >= LEVELS[i].minXp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] ?? null;
    }
  }

  const progressPct = next
    ? Math.min(
        100,
        Math.round(((safeXp - current.minXp) / (next.minXp - current.minXp)) * 100)
      )
    : 100;

  return {
    ...current,
    nextLevel: next,
    progressPct,
    xpToNext: next ? Math.max(0, next.minXp - safeXp) : 0,
  };
}

export function getAlmatyDateStr(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Almaty',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getYesterdayAlmatyDateStr(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return getAlmatyDateStr(d);
}

export function pluralizeDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} дня`;
  return `${n} дней`;
}