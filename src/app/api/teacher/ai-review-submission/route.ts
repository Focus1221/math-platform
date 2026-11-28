import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';

export const maxDuration = 60;

const MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

const REVIEW_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcribed_solution: { type: 'STRING' },
    verdict: {
      type: 'STRING',
      enum: ['correct', 'partial', 'incorrect', 'unreadable'],
    },
    suggested_score: { type: 'INTEGER' },
    error_step: { type: 'STRING' },
    teacher_comment: { type: 'STRING' },
  },
  required: [
    'transcribed_solution',
    'verdict',
    'suggested_score',
    'error_step',
    'teacher_comment',
  ],
};

interface GeminiPart {
  text?: string;
  thought?: boolean;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface AiReviewResult {
  transcribed_solution: string;
  verdict: 'correct' | 'partial' | 'incorrect' | 'unreadable';
  suggested_score: number;
  error_step: string;
  teacher_comment: string;
}

function inferMimeType(path: string, blobType?: string): string {
  if (blobType && blobType.startsWith('image/')) return blobType;
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
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

function parseReviewJson(rawText: string, maxPoints: number): AiReviewResult | null {
  const cleaned = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const slice = cleaned.slice(start, end + 1);
      try {
        parsed = JSON.parse(slice);
      } catch {
        try {
          parsed = JSON.parse(slice.replace(/\\(?!["\\/bfnrtu])/g, '\\\\'));
        } catch {
          parsed = null;
        }
      }
    }
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  const rawVerdict = String(obj.verdict || 'partial');
  const verdict: AiReviewResult['verdict'] =
    rawVerdict === 'correct' ||
    rawVerdict === 'partial' ||
    rawVerdict === 'incorrect' ||
    rawVerdict === 'unreadable'
      ? rawVerdict
      : 'partial';

  const rawScore = Number(obj.suggested_score);
  const clampedScore = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(maxPoints, Math.round(rawScore)))
    : 0;

  return {
    transcribed_solution: String(obj.transcribed_solution || '').trim(),
    verdict,
    suggested_score: clampedScore,
    error_step: String(obj.error_step || '').trim(),
    teacher_comment: String(obj.teacher_comment || '').trim(),
  };
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
    const submissionId = String(body.submissionId || '').trim();
    if (!submissionId) {
      return NextResponse.json({ error: 'Не указан ID работы' }, { status: 400 });
    }

    const { data: submission, error: subErr } = await admin
      .from('submissions')
      .select('id, task_id, answer_text, photo_path')
      .eq('id', submissionId)
      .single();

    if (subErr || !submission) {
      return NextResponse.json({ error: 'Работа ученика не найдена' }, { status: 404 });
    }

    const hasText = Boolean(submission.answer_text && submission.answer_text.trim());
    const hasPhoto = Boolean(submission.photo_path);

    if (!hasText && !hasPhoto) {
      return NextResponse.json(
        { error: 'В этой работе нет ни текста решения, ни фото тетради.' },
        { status: 400 }
      );
    }

    const [{ data: task }, { data: answerKey }] = await Promise.all([
      admin
        .from('homework_tasks')
        .select('id, topic_id, question_md, points')
        .eq('id', submission.task_id)
        .single(),
      admin
        .from('homework_answer_keys')
        .select('correct_answer, solution_hint')
        .eq('task_id', submission.task_id)
        .maybeSingle(),
    ]);

    if (!task) {
      return NextResponse.json({ error: 'Задание не найдено' }, { status: 404 });
    }

    const { data: topic } = await admin
      .from('topics')
      .select('title, section')
      .eq('id', task.topic_id)
      .maybeSingle();

    const maxPoints = Math.max(1, Number(task.points || 2));

    const parts: GeminiPart[] = [];

    // Скачиваем фото из приватного бакета student-submissions и прикладываем к запросу
    if (submission.photo_path) {
      const { data: fileBlob, error: dlErr } = await admin.storage
        .from('student-submissions')
        .download(submission.photo_path);

      if (dlErr || !fileBlob) {
        return NextResponse.json(
          { error: 'Не удалось загрузить фото тетради из хранилища.' },
          { status: 500 }
        );
      }

      const arrayBuf = await fileBlob.arrayBuffer();
      const base64 = Buffer.from(arrayBuf).toString('base64');
      const mimeType = inferMimeType(submission.photo_path, fileBlob.type);

      parts.push({
        inlineData: {
          mimeType,
          data: base64,
        },
      });
    }

    const prompt = `Ты — ассистент учителя математики в Казахстане. Помоги учителю быстро проверить развёрнутую работу ученика (текст и/или фото рукописной тетради).

Тема урока: "${topic?.title || 'Математика'}" (${topic?.section || ''})
Условие задачи: "${task.question_md}"
Максимум баллов за задачу: ${maxPoints}
${answerKey?.correct_answer ? `Эталонный ответ (если задан): "${answerKey.correct_answer}"` : ''}
${answerKey?.solution_hint ? `Подсказка / критерий: "${answerKey.solution_hint}"` : ''}
Текст ответа ученика в форме: "${submission.answer_text?.trim() || '(ученик прикрепил только фото)'}"

Задача:
1. В "transcribed_solution" аккуратно расшифруй ход решения ученика (если есть фото — перепиши пошагово, что написано в тетради; если фото размытое/нечитаемое — так и напиши).
2. Самостоятельно реши задачу и сверь каждый шаг ученика.
3. В "verdict" поставь:
   - "correct" — ход решения и ответ верные;
   - "partial" — ход решения в целом правильный, но есть вычислительная ошибка или неполное обоснование;
   - "incorrect" — неверный метод или грубая ошибка;
   - "unreadable" — фото нечитаемо или на фото нет решения этой задачи.
4. В "suggested_score" предложи справедливый целый балл от 0 до ${maxPoints}.
5. В "error_step" коротко укажи, на каком именно шаге ошибка (или пустую строку "", если ошибок нет).
6. В "teacher_comment" напиши короткий, доброжелательный и понятный ученику комментарий от лица учителя (2–4 предложения на русском языке): сначала похвали за верные шаги, затем мягко укажи, что стоит исправить.

Верни строго JSON по схеме.`;

    parts.push({ text: prompt });

    let geminiData: {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
    } | null = null;
    let lastStatus = 502;
    let lastReason = 'Нет ответа от Gemini';
    const attempts: string[] = [];

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
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
            responseSchema: REVIEW_SCHEMA,
          },
        }),
      });

      if (res.ok) {
        geminiData = await res.json();
        break;
      }

      lastStatus = res.status;
      const errText = await res.text();
      console.error(`Gemini ai-review error (${model}, ${res.status}):`, errText);

      try {
        const errJson = JSON.parse(errText);
        lastReason = errJson?.error?.message || errText.slice(0, 200);
      } catch {
        lastReason = errText.slice(0, 200);
      }

      attempts.push(`${model}:${res.status}`);

      if (res.status === 400 && lastReason.toLowerCase().includes('api key')) {
        break;
      }

      if (res.status === 503 || res.status === 429) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    if (!geminiData) {
      return NextResponse.json(
        {
          error: `Ошибка Gemini Vision (${lastStatus}) [${attempts.join(', ')}]: ${lastReason}`,
        },
        { status: 502 }
      );
    }

    const rawText = extractAnswerText(geminiData);
    const review = parseReviewJson(rawText, maxPoints);

    if (!review) {
      return NextResponse.json(
        { error: 'Не удалось разобрать ответ ИИ. Попробуй запустить анализ ещё раз.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ review });
  } catch (err) {
    console.error('ai-review-submission error:', err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Ошибка ИИ-проверки работы: ${detail}` },
      { status: 500 }
    );
  }
}