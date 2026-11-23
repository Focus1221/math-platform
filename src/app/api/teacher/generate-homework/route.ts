import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';

interface DraftGenTask {
  type: 'test' | 'input' | 'open';
  difficulty: 'base' | 'standard' | 'pro';
  points: number;
  question_md: string;
  options: string[];
  correct_answer: string;
  solution_hint: string;
}

const MODELS = [
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

function extractAnswerText(data: {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
}): string {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const finalParts = parts.filter(
    (p) => !p.thought && typeof p.text === 'string' && p.text.trim().length > 0
  );
  if (finalParts.length > 0) {
    return finalParts.map((p) => p.text).join('\n');
  }
  return parts[parts.length - 1]?.text || '';
}

function safeParseJson(rawText: string): unknown {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const slice =
    firstBrace !== -1 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;

  try {
    return JSON.parse(slice);
  } catch {
    const repaired = slice.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
    return JSON.parse(repaired);
  }
}

function sanitizeTasks(raw: unknown): DraftGenTask[] {
  if (!Array.isArray(raw)) return [];
  const tasks: DraftGenTask[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;

    const rawType = String(obj.type || 'test');
    const type: DraftGenTask['type'] =
      rawType === 'input' || rawType === 'open' ? rawType : 'test';

    const rawDiff = String(obj.difficulty || 'standard');
    const difficulty: DraftGenTask['difficulty'] =
      rawDiff === 'base' || rawDiff === 'pro' ? rawDiff : 'standard';

    const question_md = String(obj.question_md || '').trim();
    if (!question_md) continue;

    const options =
      type === 'test' && Array.isArray(obj.options)
        ? obj.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 4)
        : [];

    let correct_answer =
      type === 'open' ? '' : String(obj.correct_answer ?? '').trim();

    if (type === 'test' && options.length >= 2 && !options.includes(correct_answer)) {
      correct_answer = options[0];
    }

    const rawPoints = Number(obj.points);
    const points =
      Number.isFinite(rawPoints) && rawPoints >= 1 && rawPoints <= 10
        ? Math.round(rawPoints)
        : difficulty === 'base'
          ? 1
          : difficulty === 'pro'
            ? 3
            : 2;

    tasks.push({
      type: type === 'test' && options.length < 2 ? 'input' : type,
      difficulty,
      points,
      question_md,
      options: type === 'test' && options.length >= 2 ? options : [],
      correct_answer,
      solution_hint: String(obj.solution_hint || '').trim(),
    });
  }

  return tasks;
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Нужен вход в аккаунт' }, { status: 401 });
    }

    const admin = createAdminSupabase();
    const { data: me } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (me?.role !== 'teacher') {
      return NextResponse.json({ error: 'Доступ только для учителя' }, { status: 403 });
    }

    const apiKey = (process.env.GEMINI_API_KEY || '')
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Не задан ключ GEMINI_API_KEY в переменных окружения.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const topicId = String(body.topicId || '').trim();
    const count = Number(body.count) === 5 ? 5 : 3;
    const extraWish = String(body.extraWish || '').trim();

    if (!topicId) {
      return NextResponse.json({ error: 'Не указан ID темы' }, { status: 400 });
    }

    const { data: topic } = await admin
      .from('topics')
      .select('id, title, section, objectives, value_example, theory_md')
      .eq('id', topicId)
      .single();

    if (!topic) {
      return NextResponse.json({ error: 'Тема не найдена' }, { status: 404 });
    }

    const objectivesText = Array.isArray(topic.objectives)
      ? topic.objectives.join('; ')
      : '';

    const prompt = `Ты — опытный учитель математики в Казахстане. Составь разноуровневый комплект домашнего задания из ${count} задач на русском языке.

Тема урока: "${topic.title}"
Раздел: "${topic.section}"
Цели обучения (ЦО): "${objectivesText}"
Жизненный контекст: "${topic.value_example || ''}"
Конспект: "${(topic.theory_md || '').slice(0, 1000)}"
Пожелание учителя: "${extraWish || 'Сделай интересные, понятные и корректные по математике задачи.'}"

Состав комплекта из ${count} заданий:
${
  count === 3
    ? '- 1 задание уровня "base" (type: "test", 1 балл)\n- 1 задание уровня "standard" (type: "input", 2 балла)\n- 1 задание уровня "pro" (type: "open", 3 балла)'
    : '- 2 задания уровня "base" (type: "test", по 1 баллу)\n- 2 задания уровня "standard" (type: "input", по 2 балла)\n- 1 задание уровня "pro" (type: "open", 3 балла)'
}

Правила формата:
- Формулы пиши в LaTeX внутри одинарных долларов (в JSON экранируй обратный слэш как \\\\).
- Для type: "test" обязательно укажи 4 варианта в "options", и "correct_answer" должен ТОЧНО совпадать с одним из элементов "options".
- Для type: "input" правильный ответ в "correct_answer" должен быть коротким числом или дробью (например: "42", "3/4", "2,5"); в "options" передай [].
- Для type: "open" в "options" передай [], в "correct_answer" передай "".
- В "solution_hint" напиши короткую наводящую подсказку на случай ошибки.
- Обязательно перепроверь арифметику каждого задания!

Верни СТРОГО валидный JSON-объект вида { "tasks": [ ... ] }.`;

    let geminiData: {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
    } | null = null;
    let lastStatus = 502;
    let lastReason = 'Нет ответа от Gemini';

    for (const model of MODELS) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.6,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (res.ok) {
        geminiData = await res.json();
        break;
      }

      lastStatus = res.status;
      const errText = await res.text();
      console.error(`Gemini homework error (${model}, ${res.status}):`, errText);

      try {
        const errJson = JSON.parse(errText);
        lastReason = errJson?.error?.message || errText.slice(0, 200);
      } catch {
        lastReason = errText.slice(0, 200);
      }

      if (res.status === 400 && lastReason.toLowerCase().includes('api key')) {
        break;
      }
    }

    if (!geminiData) {
      return NextResponse.json(
        { error: `Ошибка Gemini (${lastStatus}): ${lastReason}` },
        { status: 502 }
      );
    }

    const rawText = extractAnswerText(geminiData);
    const parsed = safeParseJson(rawText) as { tasks?: unknown } | unknown[];
    const tasks = sanitizeTasks(Array.isArray(parsed) ? parsed : parsed?.tasks);

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: 'ИИ вернул пустой список заданий. Попробуй ещё раз.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error('generate-homework error:', err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Ошибка генерации ДЗ: ${detail}` },
      { status: 500 }
    );
  }
}