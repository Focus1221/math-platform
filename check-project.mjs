import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const RUN_BUILD = process.argv.includes('--build');

let passed = 0;
let warnings = 0;
let errors = 0;

function ok(msg) {
  passed++;
  console.log(`  [OK]   ${msg}`);
}

function warn(msg) {
  warnings++;
  console.log(`  [WARN] ${msg}`);
}

function fail(msg) {
  errors++;
  console.log(`  [FAIL] ${msg}`);
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function readSafe(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

// 1. Сканирование всех файлов в src/
section('1. Сканирование структуры src/');

if (!fs.existsSync(SRC_DIR)) {
  fail('Папка src/ не найдена. Запускай скрипт из корня проекта.');
  process.exit(1);
}

const allSrcFiles = walkFiles(SRC_DIR);
const codeFiles = allSrcFiles.filter((f) => /\.(ts|tsx|js|jsx|css)$/.test(f));
console.log(`  Найдено файлов кода в src/: ${codeFiles.length}`);

const IGNORED_DUP_NAMES = new Set([
  'page.tsx',
  'layout.tsx',
  'route.ts',
  'loading.tsx',
  'error.tsx',
  'not-found.tsx',
  'index.ts',
  'index.tsx',
  'types.ts',
]);

const nameMap = new Map();
let emptyCount = 0;
let conflictCount = 0;

for (const file of codeFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const shortPath = rel(file);
  const baseName = path.basename(file);

  if (content.trim().length === 0) {
    emptyCount++;
    fail(`Пустой файл: ${shortPath}`);
  }

  if (/^(<{7}|={7}|>{7})/m.test(content)) {
    conflictCount++;
    fail(`Найдены маркеры конфликта Git в файле: ${shortPath}`);
  }

  if (!IGNORED_DUP_NAMES.has(baseName)) {
    if (!nameMap.has(baseName)) nameMap.set(baseName, []);
    nameMap.get(baseName).push(shortPath);
  }
}

if (emptyCount === 0) ok('Пустых файлов не найдено');
if (conflictCount === 0) ok('Конфликтов слияния Git не найдено');

let dupCount = 0;
for (const [name, paths] of nameMap.entries()) {
  if (paths.length > 1) {
    dupCount++;
    warn(`Дубликат имени файла "${name}": ${paths.join(' | ')}`);
  }
}
if (dupCount === 0) ok('Дубликатов компонентов и хуков нет');

// 2. Проверка всех API-роутов Next.js
section('2. Проверка всех API-роутов (src/app/api/**/route.ts)');

const apiDir = path.join(SRC_DIR, 'app', 'api');
const routeFiles = walkFiles(apiDir).filter((f) => /route\.(ts|js)$/.test(f));

if (routeFiles.length === 0) {
  warn('API-роуты в src/app/api/ не найдены');
} else {
  const httpExportRe =
    /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/;
  const useClientRe = /^\s*['"]use client['"]/;

  for (const rf of routeFiles) {
    const content = fs.readFileSync(rf, 'utf8');
    const shortPath = rel(rf);
    const hasUseClient = useClientRe.test(content);
    const hasHandler = httpExportRe.test(content);

    if (hasUseClient) {
      fail(`${shortPath} содержит 'use client' (клиентский код попал в API-роут)`);
    } else if (!hasHandler) {
      fail(`${shortPath} не экспортирует GET/POST/PUT/PATCH/DELETE (вызовет TS2559)`);
    } else {
      ok(shortPath);
    }
  }
}

// 3. Проверка логики внутри ключевых файлов
section('3. Проверка кода внутри ключевых файлов');

const FILE_RULES = [
  {
    file: 'src/components/lesson/CourseWorkspace.tsx',
    mustInclude: [
      'reportPracticeSolved',
      'handlePracticeSolved',
      'onProblemSolved={handlePracticeSolved}',
    ],
  },
  {
    file: 'src/components/lesson/InteractiveTab.tsx',
    mustInclude: ['onProblemSolved', 'onProblemSolved?.(nextCorrect)'],
  },
  {
    file: 'src/hooks/useGamification.ts',
    mustInclude: ['solvedTotal', 'reportPracticeSolved', '/api/student/gamification'],
  },
  {
    file: 'src/components/gamification/LessonStarsBar.tsx',
    mustInclude: ['practice_solved', 'practice_done'],
  },
  {
    file: 'src/app/api/student/gamification/route.ts',
    mustInclude: ['export async function GET', 'export async function POST', 'solvedTotal'],
    mustNotInclude: ["'use client'", '"use client"'],
  },
  {
    file: 'src/app/api/homework/check/route.ts',
    mustInclude: ['export async function POST'],
    mustNotInclude: ["'use client'", '"use client"'],
  },
  {
    file: 'src/app/globals.css',
    mustInclude: ['@import "tailwindcss";', '[data-theme="cosmos"]'],
    mustNotInclude: ['.bg-[\\#F6F7FB]', '.bg-[\\#F4F7FB]'],
  },
];

for (const rule of FILE_RULES) {
  const content = readSafe(rule.file);
  if (content === null) {
    fail(`Файл не найден: ${rule.file}`);
    continue;
  }

  let fileHasIssues = false;

  for (const token of rule.mustInclude || []) {
    if (!content.includes(token)) {
      fileHasIssues = true;
      fail(`${rule.file} — отсутствует обязательный фрагмент: ${token}`);
    }
  }

  for (const bad of rule.mustNotInclude || []) {
    if (content.includes(bad)) {
      fileHasIssues = true;
      fail(`${rule.file} — найден нежелательный фрагмент: ${bad}`);
    }
  }

  if (!fileHasIssues) {
    ok(`${rule.file} — содержимое корректно`);
  }
}

// 4. Проверка переменных окружения (.env.local)
section('4. Проверка .env.local');

const envContent = readSafe('.env.local');
if (envContent === null) {
  warn('Файл .env.local не найден в корне (для локального запуска он нужен)');
} else {
  const envMap = new Map();
  for (const rawLine of envContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    envMap.set(key, val);
  }

  const requiredEnv = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  for (const key of requiredEnv) {
    const val = envMap.get(key);
    if (!val) {
      fail(`В .env.local отсутствует или пустая переменная: ${key}`);
    } else if (key === 'NEXT_PUBLIC_SUPABASE_URL' && !/^https:\/\/.+\.supabase\.co\/?$/.test(val)) {
      fail(`NEXT_PUBLIC_SUPABASE_URL выглядит некорректно (проверь кавычки и формат https://...supabase.co)`);
    } else {
      ok(`${key} задана`);
    }
  }
}

// 5. Проверка типов TypeScript по всему проекту
section('5. Проверка TypeScript (npx tsc --noEmit)');

const tscRes = spawnSync('npx tsc --noEmit', {
  cwd: ROOT,
  shell: true,
  encoding: 'utf8',
});

if (tscRes.status === 0) {
  ok('Ошибок TypeScript во всём проекте нет');
} else {
  fail('Найдены ошибки TypeScript:');
  const output = `${tscRes.stdout || ''}\n${tscRes.stderr || ''}`.trim();
  console.log('\n' + output + '\n');
}

// 6. Полная сборка Next.js (если передан флаг --build)
if (RUN_BUILD) {
  section('6. Проверка сборки (npm run build)');
  const buildRes = spawnSync('npm run build', {
    cwd: ROOT,
    shell: true,
    stdio: 'inherit',
  });
  if (buildRes.status === 0) {
    ok('npm run build завершился успешно');
  } else {
    fail('npm run build завершился с ошибкой');
  }
}

// Итог
section('Итог проверки');
console.log(`  Успешно: ${passed} | Предупреждений: ${warnings} | Ошибок: ${errors}`);

if (errors > 0) {
  console.log('\nИсправь строки с [FAIL] и запусти проверку снова.');
  process.exit(1);
} else {
  console.log('\nПроект в порядке — можно пушить на GitHub / Vercel.');
}