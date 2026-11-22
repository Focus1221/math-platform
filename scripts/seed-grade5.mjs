import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createClient } from '@supabase/supabase-js';

// Читаем .env.local вручную, без лишних зависимостей
const envText = fs.readFileSync(path.resolve('.env.local'), 'utf8');
for (const line of envText.split('\n')) {
  const match = line.trim().match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const html = fs.readFileSync(path.resolve('5.html'), 'utf8');

function extractConst(name) {
  const start = html.indexOf(`const ${name} =`);
  if (start === -1) throw new Error(`Не найдена переменная ${name}`);
  const eqPos = html.indexOf('=', start) + 1;
  let i = eqPos;
  while (/\s/.test(html[i])) i++;
  const open = html[i];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr = null;
  let escaped = false;

  for (; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === inStr) inStr = null;
    } else {
      if (ch === "'" || ch === '"' || ch === '`') inStr = ch;
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return vm.runInNewContext(`(${html.slice(eqPos, i + 1)})`);
      }
    }
  }
  throw new Error(`Не удалось распарсить ${name}`);
}

const BASE_TOPICS = extractConst('BASE_TOPICS');
const PRESET_THEORY = extractConst('PRESET_THEORY');
const PRESET_MATERIALS = extractConst('PRESET_MATERIALS');
const PRESET_HOMEWORK = extractConst('PRESET_HOMEWORK');

async function seed() {
  console.log(`Найдено тем в 5.html: ${BASE_TOPICS.length}`);

  const { data: course, error: courseErr } = await supabase
    .from('courses')
    .upsert(
      {
        slug: 'math-5',
        grade_number: 5,
        subject: 'Математика',
        title: 'Математика · 5 класс',
        academic_year: '2026–2027',
        total_hours: 171,
        is_published: true,
      },
      { onConflict: 'slug' }
    )
    .select()
    .single();

  if (courseErr) throw courseErr;

  // Очищаем старые темы курса при повторном запуске сида
  await supabase.from('topics').delete().eq('course_id', course.id);

  for (const t of BASE_TOPICS) {
    const defaultTheory = `### Ключевые идеи урока: ${t.title}\nРаздел: **${t.section}** (${t.dates}, ${t.hours} ч.).\n\n### Цели обучения\n${t.objectives.map((o) => `- ${o}`).join('\n')}`;

    const { data: topicRow, error: tErr } = await supabase
      .from('topics')
      .insert({
        course_id: course.id,
        order_index: t.id,
        quarter: t.quarter,
        section: t.section,
        title: t.title,
        dates: t.dates,
        hours: t.hours,
        objectives: t.objectives,
        theory_md: PRESET_THEORY[t.id] || defaultTheory,
        sim_type: t.simType || 'generator',
        badges: t.badges || [],
        is_assessment: Boolean(t.isAssessment),
        value_key: t.valueKey || 'adal',
        value_example: t.valueExample || '',
      })
      .select()
      .single();

    if (tErr) throw tErr;

    const mats = PRESET_MATERIALS[t.id] || [];
    if (mats.length > 0) {
      const { error: mErr } = await supabase.from('materials').insert(
        mats.map((m) => ({
          topic_id: topicRow.id,
          kind: m.type,
          title: m.title,
          description: m.desc || '',
          url: m.url || null,
        }))
      );
      if (mErr) throw mErr;
    }

    const hws = PRESET_HOMEWORK[t.id] || [];
    for (let idx = 0; idx < hws.length; idx++) {
      const hw = hws[idx];
      const { data: hwRow, error: hErr } = await supabase
        .from('homework_tasks')
        .insert({
          topic_id: topicRow.id,
          order_index: idx + 1,
          type: hw.type,
          question_md: hw.question,
          options: hw.options || [],
          points: hw.points || 2,
        })
        .select()
        .single();

      if (hErr) throw hErr;

      if (hw.correctAnswer) {
        const { error: kErr } = await supabase.from('homework_answer_keys').insert({
          task_id: hwRow.id,
          correct_answer: String(hw.correctAnswer),
        });
        if (kErr) throw kErr;
      }
    }
  }

  console.log('Готово! Курс 5 класса (58 тем, конспекты, материалы и ДЗ) загружен в Supabase.');
}

seed().catch((err) => {
  console.error('Ошибка импорта:', err);
  process.exit(1);
});