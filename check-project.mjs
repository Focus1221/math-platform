import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');

// Полный список ожидаемых файлов проекта MathHub
const EXPECTED_FILES = [
  // База Next.js и страницы
  'src/app/layout.tsx',
  'src/app/globals.css',
  'src/app/page.tsx',
  'src/app/login/page.tsx',
  'src/app/today/page.tsx',
  'src/app/courses/page.tsx',
  'src/app/courses/[slug]/page.tsx',
  'src/app/simulators/page.tsx',
  'src/app/teacher/journal/page.tsx',
  'src/app/teacher/submissions/page.tsx',
  'src/app/teacher/cards/[classroomId]/page.tsx',

  // API-роуты
  'src/app/api/auth/register/route.ts',
  'src/app/api/homework/check/route.ts',
  'src/app/api/simulators/progress/route.ts',
  'src/app/api/teacher/classes/route.ts',
  'src/app/api/teacher/reset-password/route.ts',
  'src/app/api/teacher/generate-homework/route.ts',
  'src/app/api/teacher/schedule/route.ts',
  'src/app/api/teacher/bulk-students/route.ts',
  'src/app/api/teacher/grade-submission/route.ts',
  'src/app/api/teacher/students/route.ts',

  // Компоненты: навигация, «Сегодня», курсы
  'src/components/layout/AppNav.tsx',
  'src/components/today/TodayClient.tsx',
  'src/components/courses/CourseListClient.tsx',

  // Компоненты: урок
  'src/components/lesson/CourseWorkspace.tsx',
  'src/components/lesson/TheoryTab.tsx',
  'src/components/lesson/InteractiveTab.tsx',
  'src/components/lesson/HomeworkTab.tsx',
  'src/components/lesson/AiTutorTab.tsx',
  'src/components/lesson/MathMarkdown.tsx',
  'src/components/lesson/TopicEditorModal.tsx',
  'src/components/lesson/ScheduleTopicModal.tsx',
  'src/components/lesson/BoardDrawOverlay.tsx',

  // Компоненты: учитель
  'src/components/teacher/JournalClient.tsx',
  'src/components/teacher/SubmissionsReviewClient.tsx',
  'src/components/teacher/PrintCardsClient.tsx',

  // Компоненты: тренажёры (8 симуляторов + лаборатория)
  'src/components/simulators/SimulatorsLabClient.tsx',
  'src/components/simulators/CoordRaySim.tsx',
  'src/components/simulators/DivisibilitySim.tsx',
  'src/components/simulators/FractionsSim.tsx',
  'src/components/simulators/ProtractorSim.tsx',
  'src/components/simulators/SetsVennSim.tsx',
  'src/components/simulators/PercentGridSim.tsx',
  'src/components/simulators/DiagramsSim.tsx',
  'src/components/simulators/TaskGeneratorSim.tsx',

  // Типы и утилиты
  'src/types/db.ts',
  'src/lib/supabase/client.ts',
  'src/lib/supabase/server.ts',
  'src/lib/supabase/admin.ts',
  'src/lib/math/utils.ts',
  'src/lib/audio/sound.ts',
  'src/lib/media/compressImage.ts',
  'src/lib/format/cleanTopic.ts',
  'src/lib/auth/studentLogin.ts',
];

function walkFiles(dir, result = []) {
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, result);
    } else {
      result.push(path.relative(ROOT, full).replace(/\\/g, '/'));
    }
  }
  return result;
}

if (!fs.existsSync(SRC_DIR)) {
  console.error('❌ Папка src/ не найдена! Запусти скрипт из корня проекта (рядом с package.json).');
  process.exit(1);
}

const actualFiles = walkFiles(SRC_DIR).sort();
const actualSet = new Set(actualFiles);
const actualLowerMap = new Map(actualFiles.map((f) => [f.toLowerCase(), f]));
const byBaseName = new Map();
for (const f of actualFiles) {
  const base = path.basename(f).toLowerCase();
  if (!byBaseName.has(base)) byBaseName.set(base, []);
  byBaseName.get(base).push(f);
}

console.log(`\n🔎 Найдено файлов в src/: ${actualFiles.length}\n`);

// 1. Проверка ожидаемых файлов
let okCount = 0;
const missing = [];
const wrongCase = [];
const wrongPlace = [];

for (const expected of EXPECTED_FILES) {
  if (actualSet.has(expected)) {
    okCount++;
    continue;
  }

  const samePathDiffCase = actualLowerMap.get(expected.toLowerCase());
  if (samePathDiffCase) {
    wrongCase.push({ expected, actual: samePathDiffCase });
    continue;
  }

  const base = path.basename(expected).toLowerCase();
  const candidates = (byBaseName.get(base) || []).filter(
    (c) => !EXPECTED_FILES.includes(c)
  );
  if (candidates.length > 0 && base !== 'page.tsx' && base !== 'route.ts') {
    wrongPlace.push({ expected, foundAt: candidates });
  } else {
    missing.push(expected);
  }
}

console.log(`✅ На месте и названы верно: ${okCount} из ${EXPECTED_FILES.length}`);

if (wrongCase.length > 0) {
  console.log('\n⚠️ Ошибка в заглавных/строчных буквах (на Vercel сломает сборку):');
  for (const item of wrongCase) {
    console.log(`   Сейчас: ${item.actual}`);
    console.log(`   Нужно:  ${item.expected}`);
  }
}

if (wrongPlace.length > 0) {
  console.log('\n📁 Файл лежит не в той папке:');
  for (const item of wrongPlace) {
    console.log(`   Ожидался: ${item.expected}`);
    console.log(`   Найден в: ${item.foundAt.join(', ')}`);
  }
}

if (missing.length > 0) {
  console.log('\n❌ Не найдены (возможно, удалены или ещё не созданы):');
  for (const f of missing) {
    console.log(`   - ${f}`);
  }
}

// 2. Проверка прокси/middleware и временных файлов
console.log('\n🧩 Доп. проверки:');
if (actualSet.has('src/proxy.ts')) {
  console.log('   ✅ src/proxy.ts на месте (формат Next.js 16)');
} else if (actualSet.has('src/middleware.ts')) {
  console.log('   ⚠️ Используется src/middleware.ts (работает, но для Next.js 16 лучше переименовать в src/proxy.ts)');
} else {
  console.log('   ⚠️ Не найден ни src/proxy.ts, ни src/middleware.ts');
}

if (fs.existsSync(path.join(ROOT, 'project-code.txt'))) {
  console.log('   ⚠️ В корне остался временный файл project-code.txt — лучше удалить.');
}

// 3. Проверка всех локальных импортов (@/ и ./)
const brokenImports = [];
const exts = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '.css'];

function resolveLocalImport(fromFile, spec) {
  let targetBase;
  if (spec.startsWith('@/')) {
    targetBase = path.join('src', spec.slice(2));
  } else if (spec.startsWith('./') || spec.startsWith('../')) {
    targetBase = path.join(path.dirname(fromFile), spec);
  } else {
    return { exists: true, caseMismatch: null };
  }

  targetBase = targetBase.replace(/\\/g, '/');
  for (const ext of exts) {
    const candidate = `${targetBase}${ext}`;
    if (actualSet.has(candidate)) return { exists: true, caseMismatch: null };
    const diffCase = actualLowerMap.get(candidate.toLowerCase());
    if (diffCase) return { exists: true, caseMismatch: `${candidate} -> ${diffCase}` };
  }
  return { exists: false, caseMismatch: null };
}

for (const file of actualFiles) {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const matches = [
    ...content.matchAll(/(?:^|\n)\s*import[\s\S]*?from\s*['"]([^'"]+)['"]/g),
    ...content.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g),
  ];

  for (const m of matches) {
    const spec = m[1];
    const res = resolveLocalImport(file, spec);
    if (!res.exists) {
      brokenImports.push(`${file}  →  не найден импорт "${spec}"`);
    } else if (res.caseMismatch) {
      brokenImports.push(`${file}  →  несовпадение регистра: ${res.caseMismatch}`);
    }
  }
}

if (brokenImports.length === 0) {
  console.log('\n✅ Битых импортов внутри src/ не найдено!');
} else {
  console.log(`\n❌ Найдено проблемных импортов (${brokenImports.length}):`);
  for (const b of brokenImports) {
    console.log(`   - ${b}`);
  }
}

// 4. Необычные / лишние файлы, которых нет в базовом списке
const expectedSet = new Set([...EXPECTED_FILES, 'src/proxy.ts', 'src/middleware.ts']);
const extraFiles = actualFiles.filter((f) => !expectedSet.has(f));
if (extraFiles.length > 0) {
  console.log(`\nℹ️ Другие файлы в src/ (например, ИИ-тьютор, сиды или старые копии):`);
  for (const f of extraFiles) {
    console.log(`   • ${f}`);
  }
}

console.log('\nГотово.\n');