import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createServerSupabase } from '@/lib/supabase/server';

type TutorMode = 'socratic' | 'error' | 'analog' | 'visual';

const MODE_INSTRUCTIONS: Record<TutorMode, { label: string; prompt: string }> = {
  socratic: {
    label: 'Наводящий вопрос',
    prompt:
      'Задай один короткий, добрый и точный наводящий вопрос (метод Сократа), который поможет ученику самому сделать следующий шаг.',
  },
  error: {
    label: 'Поиск ошибки',
    prompt:
      'Аккуратно проверь ход рассуждений ученика. Если есть ошибка — укажи на шаг, где стоит перепроверить, но НЕ пиши итоговый ответ. Если всё верно — похвали и попроси объяснить, почему этот способ работает.',
  },
  analog: {
    label: 'Похожая задача (аналог)',
    prompt:
      'Придумай и кратко разбери очень похожую простую задачу-аналог с другими, более маленькими числами, чтобы ученик по аналогии сам решил свою.',
  },
  visual: {
    label: 'Наглядное объяснение',
    prompt:
      'Объясни суть этой задачи образно и наглядно (на примере долей, полосок, координатного луча или жизненной ситуации), не выдавая готовый численный ответ.',
  },
};

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Войди в аккаунт, чтобы пользоваться ИИ-тьютором.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const topicId = String(body.topicId || '');
    const problem = String(body.problem || '').trim();
    const attempt = String(body.attempt || '').trim();
    const mode = body.mode as TutorMode;

    if (!topicId || !MODE_INSTRUCTIONS[mode]) {
      return NextResponse.json({ error: 'Некорректные параметры запроса.' }, { status: 400 });
    }

    if (problem.length < 3 || attempt.length < 3) {
      return NextResponse.json(
        { error: 'Сначала напиши условие задачи и свою самостоятельную попытку решения.' },
        { status: 400 }
      );
    }

    // Проверяем тему и режим СОР/СОЧ прямо в базе данных
    const { data: topic, error: topicErr } = await supabase
      .from('topics')
      .select('title, section, is_assessment, courses ( grade_number, subject )')
      .eq('id', topicId)
      .single();

    if (topicErr || !topic) {
      return NextResponse.json({ error: 'Тема не найдена.' }, { status: 404 });
    }

    if (topic.is_assessment) {
      return NextResponse.json(
        {
          error:
            'Режим академической честности («Адал азамат»): во время СОР и СОЧ ИИ-помощник отключён.',
        },
        { status: 403 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'На сервере не настроен GEMINI_API_KEY.' },
        { status: 500 }
      );
    }

    const rawCourse = topic.courses as
      | { grade_number?: number; subject?: string }
      | { grade_number?: number; subject?: string }[]
      | null;
    const course = Array.isArray(rawCourse) ? rawCourse[0] : rawCourse;
    const grade = course?.grade_number || 5;
    const subject = course?.subject || 'Математика';

    const chosen = MODE_INSTRUCTIONS[mode];

    const systemPrompt = `Ты — доброжелательный ИИ-тьютор по предмету «${subject}» для ученика ${grade} класса (программа Республики Казахстан).
СТРОГИЕ ПРАВИЛА:
1. НИКОГДА не выдавай готовый конечный ответ на задачу ученика! Твоя цель — научить думать самостоятельно.
2. Отвечай на русском языке, понятно для ученика ${grade} класса, кратко (4–7 предложений).
3. Поддерживай и хвали за самостоятельную попытку.
4. Для математических формул используй запись LaTeX в одинарных знаках доллара, например $\\frac{3}{4}$ или $x + 5 = 12$.
5. Текущая тема урока: «${topic.title}» (раздел: ${topic.section}).`;

    const userPrompt = `Условие задачи ученика: ${problem}
Самостоятельная попытка ученика: ${attempt}
Выбранная функция помощи: ${chosen.label}.
Инструкция: ${chosen.prompt}`;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.6,
      },
    });

    const reply = response.text?.trim();
    if (!reply) {
      return NextResponse.json({ error: 'Модель вернула пустой ответ.' }, { status: 502 });
    }

    return NextResponse.json({ reply, modeLabel: chosen.label });
  } catch (err) {
    console.error('api/tutor error:', err);
    return NextResponse.json(
      { error: 'Не удалось получить ответ от ИИ-тьютора. Попробуй через минуту.' },
      { status: 500 }
    );
  }
}