export const STUDENT_EMAIL_DOMAIN = 'student.mathhub.local';

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
  // Казахские буквы
  ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
};

export function transliterateToSlug(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]/g, '');
}

export function normalizeStudentLogin(raw: string): string {
  return transliterateToSlug(raw.trim());
}

export function studentLoginToEmail(login: string): string {
  return `${normalizeStudentLogin(login)}@${STUDENT_EMAIL_DOMAIN}`;
}

export function studentPinToPassword(pin: string): string {
  return `pin-${pin.trim()}`;
}

export function generatePinCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function buildBaseLogin(fullName: string, className: string): string {
  const cleaned = fullName
    .replace(/^\s*\d+[\.\)\-\s]+/, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const classSuffix = transliterateToSlug(className).slice(0, 4);

  // Если указано «Фамилия Имя», берём имя (детям проще вводить), иначе первое слово
  const primaryWord = parts.length >= 2 ? parts[1] : parts[0] || 'student';
  const base = transliterateToSlug(primaryWord).slice(0, 8) || 'student';

  return `${base}${classSuffix}`;
}