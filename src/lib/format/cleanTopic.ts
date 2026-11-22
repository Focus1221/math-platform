export function cleanSectionName(section: string): string {
  const cleaned = section
    .replace(/^\d+\.\d+[А-ЯЁA-Zа-яёa-z]?\s+/u, '')
    .replace(/\s*\(\d+\s*ч\.?(?:ас(?:а|ов)?)?\)\s*$/iu, '')
    .trim();
  return cleaned || section;
}

export function getLocalDateISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatShortRuDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function getScheduleBadge(
  lessonDate: string | null | undefined
): 'today' | 'tomorrow' | 'upcoming' | 'past' | null {
  if (!lessonDate) return null;
  const today = getLocalDateISO(0);
  const tomorrow = getLocalDateISO(1);
  if (lessonDate === today) return 'today';
  if (lessonDate === tomorrow) return 'tomorrow';
  if (lessonDate > tomorrow) return 'upcoming';
  return 'past';
}