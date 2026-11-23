import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';

interface GeneratedTask {
  type: 'test' | 'input' | 'open';
  difficulty: 'base' | 'standard' | 'pro';
  points: number;
  question_md: string;
  options: string[];
  correct_answer: string;
  solution_hint: string;
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
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'teacher') {
      return NextResponse.json({ error: 'Доступ только для учителя' }, { status: 403 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'На сервере не настроен GEMINI_API_KEY' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const topicId = String(body.topicId || '');
    const count = body.count === 5 ? 5 : 3;
    const extraWish = String(body.extraWish || '').trim();

    if (!topicId) {
      return NextResponse.json({ error: 'Не указана тема урока' }, { status: 400 });
    }

    const { data: topic, error: topicErr } = await admin
      .from('topics')
      .select(
        'title, section, objectives, value_example, theory_md, courses ( grade_number, subject )'
      )
      .eq('id', topicId)
      .single();

    if (topicErr || !topic) {
      return NextResponse.json({ error: 'Тема не найдена' }, { status: 404 });
    }

    const rawCourse = topic.courses as
      | { grade_number?: number; subject?: string }
      | { grade_number?: number; subject?: string }[]
      | null;
    const course = Array.isArray(rawCourse) ? rawCourse[0] : rawCourse;
    const grade = course?.grade_number || 5;
    const subject = course?.subject || 'Математика';
    const objectives = Array.isArray(topic.objectives) ? topic.objectives.join('; ') : '';

    const distribution =
      count === 3
        ? '1 задание уровня base (type: "test", points: 1), 1 задание уровня standard (type: "input", points: 2), 1 задание уровня pro (type: "open", points: 3).'
        : '2 задания уровня base (type: "test", points: 1), 2 задания уровня standard (type: "input", points: 2), 1 задание уровня pro (type: "open", points: 3).';

    const systemPrompt = `Ты — опытный учитель предмета «${subject}» (${grade} класс, программа Республики Казахстан).
Твоя задача — составить качественные, математически безошибочные домашние задания строго по теме и целям обучения (ЦО).

Верни СТРОГО валидный JSON-массив объектов без лишнего текста. Структура каждого объекта:
{
  "type": "test" | "input" | "open",
  "difficulty": "base" | "standard" | "pro",
  "points": число (1..5),
  "question_md": "условие задачи на русском, формулы в LaTeX через $...$, например $\\\\frac{3}{4}$",
  "options": ["вариант 1", "вариант 2", "вариант 3", "вариант 4"] (для "test" ровно 4 варианта; для "input" и "open" — пустой массив []),
  "correct_answer": "точный ответ" (для "test" строка ДОЛЖНА БУКВА В БУКВУ совпадать с одним из elements в options; для "input" — только число или дробь, напр. "42" или "3/4" или "2,5" без единиц измерения; для "open" — пустая строка ""),
  "solution_hint": "короткая подсказка при ошибке (1 предложение, без прямого ответа)"
}

ОБЯЗАТЕЛЬНО дважды перепроверь арифметику каждого ответа перед выводом JSON.`;

    const userPrompt = `Тема урока: «${topic.title}»
Раздел: ${topic.section}
Цели обучения (ЦО): ${objectives || 'по названию темы'}
Контекст урока: ${topic.value_example || 'нет'}
Краткий конспект: ${(topic.theory_md || '').slice(0, 1200)}
Нужно составить ровно ${count} заданий: ${distribution}
${extraWish ? `Дополнительное пожелание учителя: ${extraWish}` : ''}`;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        temperature: 0.45,
      },
    });

    const rawText = (response.text || '')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const parsed = JSON.parse(rawText);
    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { error: 'ИИ вернул неожиданный формат. Попробуйте ещё раз.' },
        { status: 502 }
      );
    }

    const tasks: GeneratedTask[] = parsed.map((item) => {
      const type: GeneratedTask['type'] =
        item.type === 'test' || item.type === 'input' || item.type === 'open'
          ? item.type
          : 'input';
      const difficulty: GeneratedTask['difficulty'] =
        item.difficulty === 'base' ||
        item.difficulty === 'standard' ||
        item.difficulty === 'pro'
          ? item.difficulty
          : 'standard';

      const options =
        type === 'test' && Array.isArray(item.options)
          ? item.options.map((o: unknown) => String(o).trim()).filter(Boolean)
          : [];

      let correct = type === 'open' ? '' : String(item.correct_answer || '').trim();
      if (type === 'test' && options.length > 0 && !options.includes(correct)) {
        correct = options[0];
      }

      return {
        type,
        difficulty,
        points: Math.max(1, Math.min(10, Number(item.points) || 2)),
        question_md: String(item.question_md || '').trim(),
        options,
        correct_answer: correct,
        solution_hint: String(item.solution_hint || '').trim(),
      };
    });

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error('generate-homework error:', err);
    return NextResponse.json(
      { error: 'Не удалось сгенерировать задания. Попробуйте ещё раз.' },
      { status: 500 }
    );
  }
}