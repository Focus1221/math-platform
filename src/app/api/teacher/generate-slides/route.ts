import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import type { LessonSlide, SlideType, SlideVisual } from '@/types/db';

const VALID_TYPES: SlideType[] = [
  'intro',
  'concept',
  'example',
  'trap',
  'quiz',
  'summary',
];

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
    // Чиним невалидные одинарные обратные слэши от LaTeX (например \%, \sqrt, \cdot)
    const repaired = slice.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
    return JSON.parse(repaired);
  }
}

function sanitizeVisual(raw: unknown): SlideVisual | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const kind = String(v.kind || '');

  if (kind === 'formula_hero' && typeof v.formula === 'string' && v.formula.trim()) {
    return {
      kind: 'formula_hero',
      formula: v.formula.trim(),
      caption: typeof v.caption === 'string' ? v.caption.trim() : undefined,
    };
  }
  if (kind === 'fraction_bar') {
    const den = Math.max(1, Math.min(16, Number(v.denominator) || 4));
    const num = Math.max(0, Math.min(den, Number(v.numerator) || 1));
    const hasCompare =
      v.compareDenominator !== undefined && v.compareNumerator !== undefined;
    return {
      kind: 'fraction_bar',
      numerator: num,
      denominator: den,
      label: typeof v.label === 'string' ? v.label.trim() : undefined,
      ...(hasCompare
        ? {
            compareDenominator: Math.max(
              1,
              Math.min(16, Number(v.compareDenominator) || 4)
            ),
            compareNumerator: Math.max(0, Number(v.compareNumerator) || 1),
          }
        : {}),
    };
  }
  if (kind === 'number_line') {
    const min = Number(v.min ?? 0);
    const max = Number(v.max ?? 10);
    const points = Array.isArray(v.points)
      ? v.points
          .filter((p) => p && typeof p === 'object')
          .map((p) => {
            const obj = p as Record<string, unknown>;
            return {
              value: Number(obj.value ?? 0),
              label: String(obj.label ?? obj.value ?? ''),
              highlight: obj.highlight !== false,
            };
          })
          .slice(0, 6)
      : [];
    const jumpObj =
      v.jump && typeof v.jump === 'object'
        ? (v.jump as Record<string, unknown>)
        : null;
    return {
      kind: 'number_line',
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) && max > min ? max : min + 10,
      points,
      ...(jumpObj
        ? {
            jump: {
              from: Number(jumpObj.from ?? min),
              to: Number(jumpObj.to ?? max),
              label:
                typeof jumpObj.label === 'string'
                  ? jumpObj.label.trim()
                  : undefined,
            },
          }
        : {}),
    };
  }
  if (kind === 'percent_grid') {
    return {
      kind: 'percent_grid',
      percent: Math.max(0, Math.min(100, Number(v.percent) || 25)),
      label: typeof v.label === 'string' ? v.label.trim() : undefined,
    };
  }
  if (kind === 'angle') {
    return {
      kind: 'angle',
      degrees: Math.max(5, Math.min(355, Number(v.degrees) || 60)),
      label: typeof v.label === 'string' ? v.label.trim() : undefined,
    };
  }
  if (kind === 'venn') {
    return {
      kind: 'venn',
      leftLabel: String(v.leftLabel || 'A'),
      rightLabel: String(v.rightLabel || 'B'),
      leftItems: Array.isArray(v.leftItems) ? v.leftItems.map(String).slice(0, 4) : [],
      rightItems: Array.isArray(v.rightItems) ? v.rightItems.map(String).slice(0, 4) : [],
      bothItems: Array.isArray(v.bothItems) ? v.bothItems.map(String).slice(0, 4) : [],
    };
  }
  if (kind === 'compare') {
    return {
      kind: 'compare',
      leftTitle: String(v.leftTitle || 'Случай 1'),
      leftText: String(v.leftText || ''),
      rightTitle: String(v.rightTitle || 'Случай 2'),
      rightText: String(v.rightText || ''),
    };
  }

  return null;
}

function sanitizeSlides(raw: unknown): LessonSlide[] {
  if (!Array.isArray(raw)) return [];
  const result: LessonSlide[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const rawType = String(obj.type || 'concept') as SlideType;
    const type: SlideType = VALID_TYPES.includes(rawType) ? rawType : 'concept';
    const title = String(obj.title || `Слайд ${i + 1}`).trim();
    const body_md = String(obj.body_md || '').trim();

    const slide: LessonSlide = {
      id: `s-${Date.now()}-${i}`,
      type,
      title,
      body_md,
      visual: sanitizeVisual(obj.visual),
    };

    if (Array.isArray(obj.steps) && obj.steps.length > 0) {
      slide.steps = obj.steps.map(String).filter(Boolean).slice(0, 6);
    }
    if (typeof obj.wrong_md === 'string' && obj.wrong_md.trim()) {
      slide.wrong_md = obj.wrong_md.trim();
    }
    if (typeof obj.right_md === 'string' && obj.right_md.trim()) {
      slide.right_md = obj.right_md.trim();
    }
    if (Array.isArray(obj.quiz_options) && obj.quiz_options.length >= 2) {
      slide.quiz_options = obj.quiz_options.map(String).slice(0, 4);
      const cIdx = Number(obj.quiz_correct_index ?? 0);
      slide.quiz_correct_index =
        cIdx >= 0 && cIdx < slide.quiz_options.length ? cIdx : 0;
      if (typeof obj.quiz_explanation === 'string') {
        slide.quiz_explanation = obj.quiz_explanation.trim();
      }
    }
    if (Array.isArray(obj.takeaways) && obj.takeaways.length > 0) {
      slide.takeaways = obj.takeaways.map(String).filter(Boolean).slice(0, 5);
    }

    result.push(slide);
  }

  return result;
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
    const extraWish = String(body.extraWish || '').trim();

    if (!topicId) {
      return NextResponse.json({ error: 'Не указан ID темы' }, { status: 400 });
    }

    const { data: topic } = await admin
      .from('topics')
      .select('id, title, section, objectives, value_example, theory_md, sim_type')
      .eq('id', topicId)
      .single();

    if (!topic) {
      return NextResponse.json({ error: 'Тема не найдена' }, { status: 404 });
    }

    const objectivesText = Array.isArray(topic.objectives)
      ? topic.objectives.join('; ')
      : '';

    const prompt = `Ты — талантливый учитель математики в Казахстане и автор интерактивных уроков в стиле Brilliant.org и Учи.ру.
Составь ЖИВУЮ, ПОНЯТНУЮ и НАСЫЩЕННУЮ ПОЛЬЗОЙ интерактивную слайд-презентацию из 6–7 слайдов на русском языке.

Тема урока: "${topic.title}"
Раздел: "${topic.section}"
Цели обучения (ЦО): "${objectivesText}"
Жизненный контекст: "${topic.value_example || ''}"
Текущий конспект (если есть): "${(topic.theory_md || '').slice(0, 1200)}"
Пожелание учителя: "${extraWish || 'Сделай максимально наглядно, интересно и живо, без канцеляризма.'}"

Требования к структуре массива "slides" (строго JSON):
1. Слайд 1 (type: "intro"): яркий жизненный заход (жизненная ситуация из Казахстана — тенге, школа, спорт, пицца, поездки), почему тема полезна.
2. Слайд 2 (type: "concept"): главное правило простым языком + обязательно добавь наглядный блок "visual".
3. Слайд 3 (type: "example"): подробный пошаговый разбор красивого примера — заполни массив "steps" (3–4 понятных шага) и при возможности "visual".
4. Слайд 4 (type: "quiz"): интерактивная мини-проверка понимания прямо внутри урока (заполни "quiz_options" — 4 варианта, "quiz_correct_index" от 0 до 3, и доброжелательное "quiz_explanation").
5. Слайд 5 (type: "trap"): разбор самой частой ошибки учеников — заполни "wrong_md" (как ошибаются) и "right_md" (как надо).
6. Слайд 6 (type: "quiz"): вторая мини-проверка чуть интереснее (практическая или с маленькой хитростью).
7. Слайд 7 (type: "summary"): шпаргалка-итог — заполни массив "takeaways" (3–4 коротких правила, которые легко запомнить).

Формулы пиши в LaTeX внутри одинарных долларов, например: $\\\\frac{3}{4}$, $25\\\\%$, $a + b = b + a$ (в JSON обязательно экранируй обратный слэш как \\\\).
Доступные виды поля "visual" (выбирай самый подходящий к теме, не выдумывай новые виды):
- { "kind": "formula_hero", "formula": "$...$", "caption": "короткое пояснение" }
- { "kind": "fraction_bar", "numerator": 3, "denominator": 4, "label": "...", "compareNumerator": 2, "compareDenominator": 4 }
- { "kind": "number_line", "min": 0, "max": 10, "points": [{"value": 3, "label": "A(3)", "highlight": true}], "jump": {"from": 3, "to": 7, "label": "+4"} }
- { "kind": "percent_grid", "percent": 35, "label": "35% = 0,35" }
- { "kind": "angle", "degrees": 60, "label": "Острый угол" }
- { "kind": "venn", "leftLabel": "Чётные", "rightLabel": "Кратны 3", "leftItems": ["2","4"], "bothItems": ["6","12"], "rightItems": ["3","9"] }
- { "kind": "compare", "leftTitle": "...", "leftText": "...", "rightTitle": "...", "rightText": "..." }

Верни СТРОГО валидный JSON-объект вида { "slides": [ ... ] } без лишнего текста вокруг.`;

    let geminiData: {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
    } | null = null;
    let lastStatus = 502;
    let lastReason = 'Нет ответа от Gemini';

    for (const model of MODELS) {
      const endpoint =
        'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(model) +
        ':generateContent';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        }),
      });
      if (res.ok) {
        geminiData = await res.json();
        break;
      }

      lastStatus = res.status;
      const errText = await res.text();
      console.error(`Gemini slides error (${model}, ${res.status}):`, errText);

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
    const parsed = safeParseJson(rawText) as { slides?: unknown } | unknown[];
    const slides = sanitizeSlides(
      Array.isArray(parsed) ? parsed : parsed?.slides
    );

    if (slides.length === 0) {
      return NextResponse.json(
        { error: 'ИИ вернул пустой набор слайдов. Попробуй сгенерировать снова.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ slides });
  } catch (err) {
    console.error('generate-slides error:', err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Ошибка генерации презентации: ${detail}` },
      { status: 500 }
    );
  }
}