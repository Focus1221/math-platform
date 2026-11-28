'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import MathMarkdown from './MathMarkdown';
import MathKeypad, { type KeypadKey } from '@/components/ui/MathKeypad';
import { playSound } from '@/lib/audio/sound';
import { compressImageFile } from '@/lib/media/compressImage';
import type { HomeworkTask, Profile, Submission, Topic } from '@/types/db';

interface Props {
  topic: Topic;
  canEdit: boolean;
  profile: Profile | null;
  onHomeworkSubmitted?: () => void;
}

interface DraftGenTask {
  type: 'test' | 'input' | 'open';
  difficulty: 'base' | 'standard' | 'pro';
  points: number;
  question_md: string;
  options: string[];
  correct_answer: string;
  solution_hint: string;
}

interface ExamSession {
  startedAt: number;
  endsAt: number;
  finishedAt?: number;
}

const DIFF_META: Record<HomeworkTask['difficulty'], { label: string; cls: string }> = {
  base: { label: 'База', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  standard: { label: 'Стандарт', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  pro: { label: 'Профи', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const HOMEWORK_KEYS: KeypadKey[] = [
  { label: ',', value: ',', title: 'Десятичная запятая' },
  { label: '/', value: '/', title: 'Черта дроби (например 3/4)' },
  { label: '−', value: '-', title: 'Минус' },
  { label: '%', value: '%', title: 'Проценты' },
  { label: '°', value: '°', title: 'Градусы' },
];

// Детерминированное перемешивание (одинаковое при F5, разное у каждого ученика)
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const rnd = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(rnd * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getDraftStorageKey(userId: string | undefined, topicId: string): string {
  return `mathhub_hw_drafts_${userId || 'guest'}_${topicId}`;
}

function getExamStorageKey(userId: string | undefined, topicId: string): string {
  return `mathhub_exam_session_${userId || 'guest'}_${topicId}`;
}

function readLocalDrafts(storageKey: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') result[k] = v;
    }
    return result;
  } catch {
    return {};
  }
}

function writeLocalDrafts(storageKey: string, drafts: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    if (Object.keys(drafts).length === 0) {
      window.localStorage.removeItem(storageKey);
    } else {
      window.localStorage.setItem(storageKey, JSON.stringify(drafts));
    }
  } catch {
    // Игнорируем ограничения приватного режима или переполнение квоты
  }
}

function readExamSession(storageKey: string): ExamSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ExamSession>;
    if (
      !parsed ||
      typeof parsed.startedAt !== 'number' ||
      typeof parsed.endsAt !== 'number'
    ) {
      return null;
    }
    return {
      startedAt: parsed.startedAt,
      endsAt: parsed.endsAt,
      finishedAt:
        typeof parsed.finishedAt === 'number' ? parsed.finishedAt : undefined,
    };
  } catch {
    return null;
  }
}

function writeExamSession(storageKey: string, session: ExamSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(session));
  } catch {
    // Игнорируем ограничения приватного режима
  }
}

function HomeworkShortInput({
  value,
  busy,
  examMode = false,
  disabled = false,
  onChange,
  onSubmit,
}: {
  value: string;
  busy: boolean;
  examMode?: boolean;
  disabled?: boolean;
  onChange: (next: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-2.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!examMode && !disabled) onSubmit();
        }}
        className="flex flex-col sm:flex-row gap-2 max-w-md"
      >
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          disabled={disabled || busy}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Введи ответ (напр. 42 или 3/4)..."
          className="flex-1 px-4 py-2.5 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 disabled:opacity-60"
        />
        {!examMode && (
          <button
            type="submit"
            disabled={busy || disabled}
            className="btn-tactile px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 disabled:opacity-60 text-white text-xs sm:text-sm font-bold transition"
          >
            {busy ? 'Проверка...' : 'Проверить'}
          </button>
        )}
      </form>

      {!disabled && (
        <MathKeypad
          value={value}
          onChange={onChange}
          inputRef={inputRef}
          symbols={HOMEWORK_KEYS}
          disabled={busy || disabled}
          align="left"
        />
      )}
    </div>
  );
}

export default function HomeworkTab({
  topic,
  canEdit,
  profile,
  onHomeworkSubmitted,
}: Props) {
  const supabase = createClient();
  const profileId = profile?.id;
  const isTeacher = profile?.role === 'teacher';
  const draftStorageKey = getDraftStorageKey(profileId, topic.id);
  const examStorageKey = getExamStorageKey(profileId, topic.id);

  // Режим СОР/СОЧ с перемешиванием и таймером активен только для учеников
  const isStudentExam = Boolean(topic.is_assessment && !canEdit && !isTeacher && profile);
  const examDurationMin = /соч/i.test(topic.title) ? 40 : 20;
  const examVariant = useMemo(() => {
    if (!profileId) return 'Вариант А';
    return hashString(`${profileId}:${topic.id}`) % 2 === 0
      ? 'Вариант А'
      : 'Вариант Б';
  }, [profileId, topic.id]);

  const [tasks, setTasks] = useState<HomeworkTask[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [unsavedDrafts, setUnsavedDrafts] = useState<Record<string, string>>({});
  const [hints, setHints] = useState<Record<string, string>>({});
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Состояние экзамена СОР / СОЧ
  const [examSession, setExamSession] = useState<ExamSession | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [submittingExam, setSubmittingExam] = useState(false);
  const [examAutoExpired, setExamAutoExpired] = useState(false);

  // Поля ручного конструктора ДЗ
  const [hwType, setHwType] = useState<'test' | 'input' | 'open'>('test');
  const [difficulty, setDifficulty] = useState<'base' | 'standard' | 'pro'>('standard');
  const [points, setPoints] = useState(2);
  const [questionMd, setQuestionMd] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [solutionHint, setSolutionHint] = useState('');
  const [creating, setCreating] = useState(false);

  // Поля ИИ-генератора ДЗ
  const [aiCount, setAiCount] = useState<3 | 5>(3);
  const [aiWish, setAiWish] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiDrafts, setAiDrafts] = useState<DraftGenTask[]>([]);
  const [savingDrafts, setSavingDrafts] = useState(false);

  const draftAnswersRef = useRef(draftAnswers);
  const submissionsRef = useRef(submissions);
  const tasksRef = useRef(tasks);
  const finishLockRef = useRef(false);

  useEffect(() => {
    draftAnswersRef.current = draftAnswers;
  }, [draftAnswers]);

  useEffect(() => {
    submissionsRef.current = submissions;
  }, [submissions]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Перемешиваем задания и варианты тестов индивидуально для ученика на СОР/СОЧ
  const displayTasks = useMemo(() => {
    if (!isStudentExam || !profileId) return tasks;
    const topicSeed = hashString(`${profileId}:${topic.id}`);
    return seededShuffle(tasks, topicSeed).map((t) =>
      t.type === 'test' && t.options.length > 1
        ? {
            ...t,
            options: seededShuffle(t.options, hashString(`${profileId}:${t.id}`)),
          }
        : t
    );
  }, [isStudentExam, profileId, tasks, topic.id]);

  useEffect(() => {
    let cancelled = false;
    finishLockRef.current = false;

    async function load() {
      setLoading(true);
      setAiDrafts([]);
      setAiError('');
      setExamAutoExpired(false);

      try {
        const { data: taskRows } = await supabase
          .from('homework_tasks')
          .select('*')
          .eq('topic_id', topic.id)
          .order('order_index', { ascending: true });

        const loadedTasks = (taskRows as HomeworkTask[]) || [];
        if (cancelled) return;
        setTasks(loadedTasks);
        setHints({});

        const validTaskIds = new Set(loadedTasks.map((t) => t.id));
        const savedLocal = readLocalDrafts(draftStorageKey);
        const subMap: Record<string, Submission> = {};
        const mergedDrafts: Record<string, string> = {};
        const signedMap: Record<string, string> = {};

        if (profileId && loadedTasks.length > 0) {
          const { data: subRows } = await supabase
            .from('submissions')
            .select('*')
            .eq('student_id', profileId)
            .in(
              'task_id',
              loadedTasks.map((t) => t.id)
            );

          if (cancelled) return;

          for (const sub of (subRows as Submission[]) || []) {
            subMap[sub.task_id] = sub;
            mergedDrafts[sub.task_id] = sub.answer_text || '';
            if (sub.photo_path) {
              const { data: signed } = await supabase.storage
                .from('student-submissions')
                .createSignedUrl(sub.photo_path, 3600);
              if (signed?.signedUrl) signedMap[sub.task_id] = signed.signedUrl;
            }
          }
        }

        const cleanedLocal: Record<string, string> = {};
        for (const [taskId, localVal] of Object.entries(savedLocal)) {
          if (!validTaskIds.has(taskId)) continue;
          const serverVal = subMap[taskId]?.answer_text || '';
          if (localVal !== serverVal) {
            mergedDrafts[taskId] = localVal;
            cleanedLocal[taskId] = localVal;
          }
        }
        writeLocalDrafts(draftStorageKey, cleanedLocal);

        // Определяем статус экзамена СОР / СОЧ (учитывая сдачу на другом устройстве)
        let resolvedSession: ExamSession | null = null;
        if (isStudentExam && loadedTasks.length > 0) {
          const savedSession = readExamSession(examStorageKey);
          const hasAutoChecked = loadedTasks.some(
            (t) => t.type !== 'open' && subMap[t.id]?.status === 'checked'
          );
          const allHaveSubs = loadedTasks.every((t) => Boolean(subMap[t.id]));

          if (hasAutoChecked || allHaveSubs) {
            const now = Date.now();
            resolvedSession = savedSession
              ? { ...savedSession, finishedAt: savedSession.finishedAt || now }
              : { startedAt: now, endsAt: now, finishedAt: now };
            writeExamSession(examStorageKey, resolvedSession);
          } else if (savedSession) {
            resolvedSession = savedSession;
          }
        }

        if (!cancelled) {
          setSubmissions(subMap);
          setDraftAnswers(mergedDrafts);
          setUnsavedDrafts(cleanedLocal);
          setPhotoUrls(signedMap);
          setExamSession(resolvedSession);
          if (resolvedSession && !resolvedSession.finishedAt) {
            setRemainingSec(
              Math.max(0, Math.ceil((resolvedSession.endsAt - Date.now()) / 1000))
            );
          } else {
            setRemainingSec(null);
          }
        }
      } catch (err) {
        console.error('Homework load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [topic.id, profileId, draftStorageKey, examStorageKey, isStudentExam]);

  const examStarted = Boolean(examSession);
  const examFinished = Boolean(examSession?.finishedAt);
  const examActive = isStudentExam && tasks.length > 0 && examStarted && !examFinished;
  const examNotStarted = isStudentExam && tasks.length > 0 && !examStarted;
  const examLocked = isStudentExam && examFinished;

  function handleStartExam() {
    playSound('click');
    const now = Date.now();
    const session: ExamSession = {
      startedAt: now,
      endsAt: now + examDurationMin * 60 * 1000,
    };
    writeExamSession(examStorageKey, session);
    setExamSession(session);
    setRemainingSec(examDurationMin * 60);
  }

  const finishExam = useCallback(
    async (autoByTimer: boolean) => {
      if (!profileId || finishLockRef.current) return;

      const currentTasks = tasksRef.current;
      const currentDrafts = draftAnswersRef.current;
      const currentSubs = submissionsRef.current;

      if (!autoByTimer) {
        const answeredCount = currentTasks.filter((t) => {
          const text = (currentDrafts[t.id] || '').trim();
          const hasPhoto = Boolean(currentSubs[t.id]?.photo_path);
          return text.length > 0 || hasPhoto;
        }).length;

        const msg =
          answeredCount < currentTasks.length
            ? `Ты ответил(а) на ${answeredCount} из ${currentTasks.length} заданий. Завершить и сдать работу сейчас? После сдачи изменить ответы будет нельзя.`
            : 'Завершить и сдать СОР / СОЧ на проверку? После сдачи изменить ответы будет нельзя.';

        if (!confirm(msg)) return;
      }

      finishLockRef.current = true;
      setSubmittingExam(true);
      if (autoByTimer) setExamAutoExpired(true);

      const nextSubmissions: Record<string, Submission> = { ...currentSubs };

      try {
        for (const t of currentTasks) {
          const answerText = (currentDrafts[t.id] || '').trim();
          const existingSub = nextSubmissions[t.id];

          // Для открытых задач отправляем, только если есть текст (фото уже сохранено при загрузке)
          if (t.type === 'open') {
            if (!answerText && !existingSub?.photo_path) continue;
            if (existingSub && (existingSub.answer_text || '').trim() === answerText) {
              continue;
            }
          }

          const res = await fetch('/api/homework/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId: t.id,
              answerText,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.submission) {
              nextSubmissions[t.id] = data.submission as Submission;
            }
          }
        }

        setSubmissions(nextSubmissions);
        setUnsavedDrafts({});
        writeLocalDrafts(draftStorageKey, {});

        const now = Date.now();
        setExamSession((prev) => {
          const doneSession: ExamSession = prev
            ? { ...prev, finishedAt: now }
            : { startedAt: now, endsAt: now, finishedAt: now };
          writeExamSession(examStorageKey, doneSession);
          return doneSession;
        });
        setRemainingSec(0);

        playSound('celebrate');
        onHomeworkSubmitted?.();
      } catch (err) {
        console.error('finishExam error:', err);
        finishLockRef.current = false;
        alert('Не удалось завершить сдачу из-за ошибки сети. Попробуй нажать «Сдать» ещё раз.');
      } finally {
        setSubmittingExam(false);
      }
    },
    [profileId, draftStorageKey, examStorageKey, onHomeworkSubmitted]
  );

  // Живой отсчёт таймера СОР / СОЧ + автоотправка по истечении времени
  useEffect(() => {
    if (!examActive || !examSession) return;

    const tick = () => {
      const left = Math.max(0, Math.ceil((examSession.endsAt - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) {
        void finishExam(true);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [examActive, examSession, finishExam]);

  function handleDraftChange(taskId: string, nextValue: string) {
    if (examLocked) return;
    setDraftAnswers((prev) => ({ ...prev, [taskId]: nextValue }));
    setUnsavedDrafts((prev) => {
      const serverVal = submissions[taskId]?.answer_text || '';
      const next = { ...prev };
      if (nextValue === serverVal) {
        delete next[taskId];
      } else {
        next[taskId] = nextValue;
      }
      writeLocalDrafts(draftStorageKey, next);
      return next;
    });
  }

  function clearLocalDraft(taskId: string) {
    setUnsavedDrafts((prev) => {
      if (!(taskId in prev)) return prev;
      const next = { ...prev };
      delete next[taskId];
      writeLocalDrafts(draftStorageKey, next);
      return next;
    });
  }

  async function submitAnswer(taskId: string, answerText: string, photoPath?: string | null) {
    if (!profile) {
      alert('Войди в аккаунт, чтобы решать и отправлять домашние задания.');
      return;
    }
    if (examLocked) return;

    setBusyTaskId(taskId);
    try {
      const res = await fetch('/api/homework/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, answerText, photoPath }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Ошибка проверки ответа');
        return;
      }

      const sub = data.submission as Submission;
      if (sub.status === 'checked') {
        playSound(sub.is_correct ? 'success' : 'error');
      } else {
        playSound('success');
      }

      const nextSubmissions = { ...submissions, [taskId]: sub };
      setSubmissions(nextSubmissions);
      setDraftAnswers((prev) => ({ ...prev, [taskId]: sub.answer_text || '' }));
      clearLocalDraft(taskId);

      // В обычном ДЗ зажигаем звезду, когда все задания урока выполнены
      if (!isStudentExam) {
        const allCompleted =
          tasks.length > 0 &&
          tasks.every((t) => {
            const s = nextSubmissions[t.id];
            if (!s) return false;
            return t.type === 'open' ? true : Boolean(s.is_correct);
          });
        if (allCompleted) {
          onHomeworkSubmitted?.();
        }
      }

      if (!isStudentExam && data.hint) {
        setHints((prev) => ({ ...prev, [taskId]: data.hint }));
      } else {
        setHints((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      }
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handlePhotoUpload(taskId: string, file: File) {
    if (!profile) {
      alert('Войди в аккаунт, чтобы прикрепить фото тетради.');
      return;
    }
    if (examLocked) return;

    setBusyTaskId(taskId);
    const preparedFile = await compressImageFile(file);

    if (preparedFile.size > 5 * 1024 * 1024) {
      alert('Фото всё ещё слишком большое (макс. 5 МБ).');
      setBusyTaskId(null);
      return;
    }

    const ext = preparedFile.name.split('.').pop() || 'jpg';
    const path = `${profile.id}/${taskId}_${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('student-submissions')
      .upload(path, preparedFile);

    if (upErr) {
      alert('Ошибка загрузки фото: ' + upErr.message);
      setBusyTaskId(null);
      return;
    }

    const { data: signed } = await supabase.storage
      .from('student-submissions')
      .createSignedUrl(path, 3600);
    if (signed?.signedUrl) {
      setPhotoUrls((prev) => ({ ...prev, [taskId]: signed.signedUrl }));
    }

    await submitAnswer(taskId, draftAnswers[taskId] || '', path);
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!questionMd.trim()) return;

    const options =
      hwType === 'test'
        ? optionsText
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    if (hwType === 'test' && options.length < 2) {
      alert('Для теста укажите минимум 2 варианта ответа через точку с запятой (;)');
      return;
    }
    if (hwType !== 'open' && !correctAnswer.trim()) {
      alert('Укажите правильный ответ для автопроверки.');
      return;
    }

    setCreating(true);
    const nextOrder = tasks.length
      ? Math.max(...tasks.map((t) => t.order_index)) + 1
      : 1;

    const { data: created, error } = await supabase
      .from('homework_tasks')
      .insert({
        topic_id: topic.id,
        order_index: nextOrder,
        type: hwType,
        difficulty,
        question_md: questionMd.trim(),
        options,
        points: Math.max(1, points),
      })
      .select()
      .single();

    if (error || !created) {
      alert('Ошибка создания задания: ' + error?.message);
      setCreating(false);
      return;
    }

    if (hwType !== 'open') {
      const { error: keyErr } = await supabase.from('homework_answer_keys').insert({
        task_id: created.id,
        correct_answer: correctAnswer.trim(),
        solution_hint: solutionHint.trim(),
      });
      if (keyErr) {
        alert('Задание создано, но ключ ответа не сохранился: ' + keyErr.message);
      }
    }

    setTasks((prev) => [...prev, created as HomeworkTask]);
    setQuestionMd('');
    setOptionsText('');
    setCorrectAnswer('');
    setSolutionHint('');
    setCreating(false);
  }

  async function handleGenerateAi() {
    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch('/api/teacher/generate-homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: topic.id,
          count: aiCount,
          extraWish: aiWish,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'Ошибка генерации');
        return;
      }
      setAiDrafts(data.tasks || []);
    } catch {
      setAiError('Сетевая ошибка при обращении к ИИ.');
    } finally {
      setAiLoading(false);
    }
  }

  function updateDraft(index: number, patch: Partial<DraftGenTask>) {
    setAiDrafts((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  }

  async function handleSaveAiDrafts() {
    if (aiDrafts.length === 0) return;
    setSavingDrafts(true);
    let nextOrder = tasks.length
      ? Math.max(...tasks.map((t) => t.order_index)) + 1
      : 1;
    const inserted: HomeworkTask[] = [];

    for (const draft of aiDrafts) {
      if (!draft.question_md.trim()) continue;
      const { data: created, error } = await supabase
        .from('homework_tasks')
        .insert({
          topic_id: topic.id,
          order_index: nextOrder++,
          type: draft.type,
          difficulty: draft.difficulty,
          question_md: draft.question_md.trim(),
          options: draft.type === 'test' ? draft.options : [],
          points: Math.max(1, draft.points),
        })
        .select()
        .single();

      if (!error && created) {
        inserted.push(created as HomeworkTask);
        if (draft.type !== 'open') {
          await supabase.from('homework_answer_keys').insert({
            task_id: created.id,
            correct_answer: draft.correct_answer.trim(),
            solution_hint: draft.solution_hint.trim(),
          });
        }
      }
    }

    if (inserted.length > 0) {
      setTasks((prev) => [...prev, ...inserted]);
      setAiDrafts([]);
      setAiWish('');
    }
    setSavingDrafts(false);
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Удалить это домашнее задание?')) return;
    const { error } = await supabase.from('homework_tasks').delete().eq('id', taskId);
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      clearLocalDraft(taskId);
    }
  }

  const maxPoints = tasks.reduce((sum, t) => sum + t.points, 0);
  const earnedPoints = tasks.reduce(
    (sum, t) => sum + (submissions[t.id]?.score || 0),
    0
  );
  const answeredInExamCount = tasks.filter((t) => {
    const txt = (draftAnswers[t.id] || '').trim();
    return txt.length > 0 || Boolean(submissions[t.id]?.photo_path);
  }).length;

  const isLowTime = remainingSec !== null && remainingSec <= 120;
  const isWarnTime = remainingSec !== null && remainingSec <= 300 && !isLowTime;

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-sm text-slate-500">
        Загрузка домашних заданий...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Инфо-баннер для учителя на темах СОР/СОЧ */}
      {topic.is_assessment && isTeacher && (
        <div className="rounded-3xl bg-amber-50 border-2 border-amber-300 px-5 py-3.5 text-xs sm:text-sm font-semibold text-amber-950 flex flex-wrap items-center justify-between gap-2">
          <div>
            🛡️ <strong>Защита СОР / СОЧ активна для учеников:</strong> индивидуальное
            перемешивание заданий и вариантов, таймер <strong>{examDurationMin} мин</strong>,
            единая сдача без подбора и отключённый Сократ.
          </div>
          <span className="px-2.5 py-1 rounded-xl bg-white border border-amber-200 text-xs font-extrabold text-amber-800">
            Просмотр учителя
          </span>
        </div>
      )}

      {/* Липкая панель таймера и сдачи во время активного СОР / СОЧ */}
      {examActive && (
        <div
          className={`sticky top-[72px] z-20 rounded-2xl border-2 px-4 py-3 shadow-md flex flex-wrap items-center justify-between gap-3 backdrop-blur-md ${
            isLowTime
              ? 'bg-rose-50/95 border-rose-400 text-rose-900'
              : isWarnTime
                ? 'bg-amber-50/95 border-amber-400 text-amber-950'
                : 'bg-white/95 border-indigo-300 text-slate-900'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 text-xs font-extrabold">
              🛡️ СОР / СОЧ · {examVariant}
            </span>
            <span
              className={`px-3 py-1 rounded-xl font-mono text-sm sm:text-base font-extrabold tabular-nums ${
                isLowTime
                  ? 'bg-rose-600 text-white animate-pulse'
                  : isWarnTime
                    ? 'bg-amber-500 text-white'
                    : 'bg-indigo-600 text-white'
              }`}
            >
              ⏱️ {formatCountdown(remainingSec ?? 0)}
            </span>
            <span className="text-xs font-bold opacity-80 tabular-nums">
              Отвечено: {answeredInExamCount} / {tasks.length}
            </span>
          </div>

          <button
            type="button"
            disabled={submittingExam}
            onClick={() => void finishExam(false)}
            className="btn-tactile px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 border-emerald-800 disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold"
          >
            {submittingExam ? 'Отправляем...' : '📤 Сдать работу'}
          </button>
        </div>
      )}

      {/* Итоговый баннер после завершения СОР / СОЧ */}
      {examLocked && (
        <div className="rounded-3xl bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 p-5 flex flex-wrap items-center justify-between gap-3 animate-pop">
          <div className="space-y-1">
            <div className="text-sm sm:text-base font-extrabold text-emerald-950">
              {examAutoExpired
                ? '⏰ Время вышло — ответы автоматически сохранены!'
                : '🏁 Работа СОР / СОЧ успешно сдана!'}
            </div>
            <p className="text-xs text-emerald-800">
              {examVariant} · Изменение ответов закрыто. Если есть открытые задачи,
              учитель проверит их и выставит дополнительные баллы.
            </p>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-white border border-emerald-300 text-emerald-800 text-sm font-extrabold tabular-nums">
            Итог: {earnedPoints} / {maxPoints} б.
          </div>
        </div>
      )}

      {/* Обычная шапка ДЗ (не показываем во время активного экзамена) */}
      {!examActive && !examNotStarted && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {topic.is_assessment ? 'Задания СОР / СОЧ' : 'Домашние задания к уроку'}
            </h3>
            <p className="text-xs text-slate-500">
              Тесты и краткие ответы проверяются мгновенно; черновики сохраняются автоматически.
            </p>
          </div>
          {tasks.length > 0 && (
            <div className="px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold tabular-nums">
              Набрано: {earnedPoints} / {maxPoints} б.
            </div>
          )}
        </div>
      )}

      {/* Экран старта СОР / СОЧ для ученика */}
      {examNotStarted ? (
        <div className="bg-white rounded-3xl border-2 border-amber-300 shadow-sm p-6 sm:p-8 text-center max-w-2xl mx-auto space-y-5 animate-pop">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-3xl">
            🛡️
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-extrabold">
              <span>🏆 СОР / СОЧ</span>
              <span>·</span>
              <span>{examVariant}</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Готов(а) начать проверочную работу?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
              После нажатия кнопки запустится таймер. Ответы сохраняются автоматически,
              а итоговый результат появится сразу после сдачи работы.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 max-w-md mx-auto">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-lg font-extrabold text-indigo-600 tabular-nums">
                {tasks.length}
              </div>
              <div className="text-[11px] font-bold text-slate-500">заданий</div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-lg font-extrabold text-amber-600 tabular-nums">
                {examDurationMin} мин
              </div>
              <div className="text-[11px] font-bold text-slate-500">на работу</div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-lg font-extrabold text-emerald-600 tabular-nums">
                {maxPoints} б.
              </div>
              <div className="text-[11px] font-bold text-slate-500">максимум</div>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={handleStartExam}
              className="btn-tactile px-7 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 text-white text-sm sm:text-base font-extrabold shadow-xs"
            >
              🚀 Начать СОР / СОЧ
            </button>
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 text-center space-y-2">
          <div className="text-3xl">📝</div>
          <p className="text-sm font-bold text-slate-700">
            Для этой темы домашнее задание ещё не назначено
          </p>
          <p className="text-xs text-slate-500">
            {canEdit
              ? 'Нажми «Сгенерировать через ИИ» ниже или добавь задание вручную.'
              : 'Загляни во вкладку «2. Потренироваться», чтобы попрактиковаться!'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayTasks.map((hw, idx) => {
            const sub = submissions[hw.id];
            const diff = DIFF_META[hw.difficulty] || DIFF_META.standard;
            const busy = busyTaskId === hw.id || submittingExam;
            const hasLocalDraft = hw.id in unsavedDrafts;
            const typeLabel =
              hw.type === 'test'
                ? 'Тест'
                : hw.type === 'input'
                  ? 'Краткий ответ'
                  : 'Развёрнутое решение';

            return (
              <div
                key={hw.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold">
                      Задание №{idx + 1}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${diff.cls}`}
                    >
                      {diff.label}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {typeLabel} · {hw.points} б.
                    </span>
                    {examActive && (draftAnswers[hw.id] || '').trim() && (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                        ✓ Ответ записан
                      </span>
                    )}
                    {!examActive && hasLocalDraft && (
                      <span
                        className="px-2 py-0.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-bold"
                        title="Введённый текст сохранён в браузере и не пропадёт при обновлении страницы"
                      >
                        💾 Черновик сохранён
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(hw.id)}
                      className="text-xs font-bold text-rose-500 hover:text-rose-700"
                    >
                      Удалить
                    </button>
                  )}
                </div>

                <MathMarkdown content={hw.question_md} />

                {/* Тест */}
                {hw.type === 'test' && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {hw.options.map((opt) => {
                        const chosenInExam = examActive && draftAnswers[hw.id] === opt;
                        const chosenSubmitted = !examActive && sub?.answer_text === opt;

                        let cls =
                          'border-slate-200 bg-slate-50 hover:border-indigo-300 text-slate-700';
                        if (chosenInExam) {
                          cls =
                            'border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200';
                        } else if (chosenSubmitted && sub?.status === 'checked') {
                          cls = sub.is_correct
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                            : 'border-rose-500 bg-rose-50 text-rose-900';
                        }

                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={busy || examLocked}
                            onClick={() => {
                              if (examActive) {
                                playSound('click');
                                handleDraftChange(hw.id, opt);
                              } else {
                                void submitAnswer(hw.id, opt);
                              }
                            }}
                            className={`text-left px-4 py-3 rounded-2xl border-2 text-xs sm:text-sm font-semibold transition disabled:cursor-default ${cls}`}
                          >
                            <MathMarkdown content={opt} inline />
                          </button>
                        );
                      })}
                    </div>

                    {!examActive && sub?.status === 'checked' && (
                      <div
                        className={`text-xs font-bold ${
                          sub.is_correct ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {sub.is_correct
                          ? `✓ Верно! Начислено ${sub.score} б.`
                          : examLocked
                            ? '✗ Ответ неверный (0 б.).'
                            : '✗ Неверно. Попробуй другой вариант!'}
                      </div>
                    )}
                  </div>
                )}

                {/* Краткий ответ с умной мат-клавиатурой и автосохранением */}
                {hw.type === 'input' && (
                  <div className="space-y-2.5">
                    <HomeworkShortInput
                      value={draftAnswers[hw.id] ?? ''}
                      busy={busy}
                      examMode={examActive || examLocked}
                      disabled={examLocked}
                      onChange={(next) => handleDraftChange(hw.id, next)}
                      onSubmit={() => submitAnswer(hw.id, draftAnswers[hw.id] || '')}
                    />

                    {!examActive && sub?.status === 'checked' && (
                      <div
                        className={`text-xs font-bold ${
                          sub.is_correct ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {sub.is_correct
                          ? `✓ Верно! Начислено ${sub.score} б.`
                          : examLocked
                            ? '✗ Ответ неверный (0 б.).'
                            : '✗ Ответ не совпадает. Перепроверь вычисления и попробуй ещё раз.'}
                      </div>
                    )}
                  </div>
                )}

                {!isStudentExam && hints[hw.id] && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    💡 <strong>Подсказка:</strong> {hints[hw.id]}
                  </div>
                )}

                {/* Развёрнутое решение с автосохранением текста */}
                {hw.type === 'open' && (
                  <div className="space-y-3">
                    <textarea
                      rows={3}
                      disabled={examLocked}
                      value={draftAnswers[hw.id] ?? ''}
                      onChange={(e) => handleDraftChange(hw.id, e.target.value)}
                      placeholder="Напиши ход решения здесь (или прикрепи фото тетради)..."
                      className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />

                    {!examLocked && (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition">
                          📷 {busy ? 'Сжимаем и загружаем...' : 'Прикрепить фото тетради'}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={busy}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handlePhotoUpload(hw.id, f);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>

                        {!examActive && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => submitAnswer(hw.id, draftAnswers[hw.id] || '')}
                            className="btn-tactile px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 border-emerald-800 disabled:opacity-60 text-white text-xs sm:text-sm font-bold transition"
                          >
                            {sub ? 'Обновить решение' : 'Отправить учителю'}
                          </button>
                        )}
                      </div>
                    )}

                    {photoUrls[hw.id] && (
                      <div className="pt-1">
                        <p className="text-[11px] font-semibold text-slate-500 mb-1">
                          Прикреплённое фото тетради:
                        </p>
                        <a href={photoUrls[hw.id]} target="_blank" rel="noopener noreferrer">
                          <img
                            src={photoUrls[hw.id]}
                            alt="Фото решения"
                            className="max-h-56 rounded-2xl border border-slate-200 shadow-xs"
                          />
                        </a>
                      </div>
                    )}

                    {sub?.status === 'pending_review' && (
                      <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-800">
                        ⏳ Решение отправлено и ожидает проверки учителя.
                      </div>
                    )}

                    {sub?.status === 'graded' && (
                      <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                        <div className="font-bold">
                          ✓ Проверено учителем: {sub.score} / {hw.points} б.
                        </div>
                        {sub.teacher_comment && (
                          <div>
                            <strong>Комментарий:</strong> {sub.teacher_comment}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Нижняя кнопка сдачи в конце СОР / СОЧ */}
          {examActive && (
            <div className="rounded-3xl bg-white border-2 border-emerald-300 p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs sm:text-sm font-bold text-slate-700">
                Проверил(а) все ответы? Отвечено {answeredInExamCount} из {tasks.length}.
              </div>
              <button
                type="button"
                disabled={submittingExam}
                onClick={() => void finishExam(false)}
                className="btn-tactile px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 border-emerald-800 disabled:opacity-60 text-white text-sm font-extrabold"
              >
                {submittingExam ? 'Отправляем...' : '📤 Завершить и сдать СОР / СОЧ'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ИИ-генератор ДЗ (только для учителя) */}
      {canEdit && (
        <div className="bg-gradient-to-br from-violet-50 via-white to-indigo-50 rounded-3xl border-2 border-violet-200 shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-violet-950">
                ✨ ИИ-генератор ДЗ по теме и ЦО
              </h4>
              <p className="text-xs text-slate-600">
                Gemini составит разноуровневый комплект (База / Стандарт / Профи) с ключами. Ты проверишь и сохранишь.
              </p>
            </div>
            <div className="inline-flex p-1 bg-white rounded-xl border border-violet-200">
              {([3, 5] as const).map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setAiCount(cnt)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    aiCount === cnt ? 'bg-violet-600 text-white' : 'text-slate-600'
                  }`}
                >
                  {cnt} задания
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={aiWish}
              onChange={(e) => setAiWish(e.target.value)}
              placeholder="Пожелание (необязательно, напр.: добавь текстовую задачу про покупки в тенге)"
              className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-violet-200 rounded-xl focus:outline-none focus:border-violet-500"
            />
            <button
              type="button"
              disabled={aiLoading}
              onClick={handleGenerateAi}
              className="btn-tactile px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 border-violet-800 disabled:opacity-60 text-white text-xs sm:text-sm font-bold shadow-xs transition shrink-0"
            >
              {aiLoading ? 'Генерация...' : `✨ Сгенерировать (${aiCount})`}
            </button>
          </div>

          {aiError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
              {aiError}
            </div>
          )}

          {aiDrafts.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-violet-200/70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-violet-900">
                  Проверь черновики перед добавлением в урок ({aiDrafts.length}):
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAiDrafts([])}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600"
                  >
                    Отменить
                  </button>
                  <button
                    type="button"
                    disabled={savingDrafts}
                    onClick={handleSaveAiDrafts}
                    className="btn-tactile px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 border-emerald-800 disabled:opacity-60 text-white text-xs font-bold transition"
                  >
                    {savingDrafts ? 'Сохранение...' : `💾 Сохранить все (${aiDrafts.length})`}
                  </button>
                </div>
              </div>

              {aiDrafts.map((draft, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-violet-200 p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <span className="px-2 py-0.5 rounded-lg bg-violet-100 text-violet-800">
                        #{i + 1} · {draft.type === 'test' ? 'Тест' : draft.type === 'input' ? 'Ответ' : 'Открытая'}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                        {DIFF_META[draft.difficulty].label} · {draft.points} б.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAiDrafts((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="text-xs font-bold text-rose-500 hover:underline"
                    >
                      Убрать
                    </button>
                  </div>

                  <textarea
                    rows={2}
                    value={draft.question_md}
                    onChange={(e) => updateDraft(i, { question_md: e.target.value })}
                    className="w-full p-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />

                  <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Как увидит ученик:
                    </div>
                    <MathMarkdown content={draft.question_md} />
                  </div>

                  {draft.type === 'test' && (
                    <input
                      type="text"
                      value={draft.options.join('; ')}
                      onChange={(e) =>
                        updateDraft(i, {
                          options: e.target.value
                            .split(';')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      placeholder="Варианты через ;"
                    />
                  )}

                  {draft.type !== 'open' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={draft.correct_answer}
                        onChange={(e) => updateDraft(i, { correct_answer: e.target.value })}
                        className="px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50/50 border border-emerald-200 rounded-xl"
                        placeholder="Правильный ответ"
                      />
                      <input
                        type="text"
                        value={draft.solution_hint}
                        onChange={(e) => updateDraft(i, { solution_hint: e.target.value })}
                        className="px-3 py-2 text-xs bg-amber-50/40 border border-amber-200 rounded-xl"
                        placeholder="Подсказка при ошибке"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ручной конструктор нового задания */}
      {canEdit && (
        <form
          onSubmit={handleCreateTask}
          className="bg-white rounded-3xl border-2 border-indigo-200 shadow-xs p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm sm:text-base font-bold text-indigo-900">
              🛠️ Добавить задание вручную
            </h4>
            <span className="text-xs font-semibold text-indigo-600">
              Поддерживает формулы $LaTeX$
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select
              value={hwType}
              onChange={(e) => setHwType(e.target.value as typeof hwType)}
              className="sm:col-span-2 px-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="test">Тест с выбором варианта (автопроверка)</option>
              <option value="input">Краткий ответ / число (автопроверка)</option>
              <option value="open">Развёрнутая задача (текст + фото тетради)</option>
            </select>

            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
              className="px-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="base">Уровень: База</option>
              <option value="standard">Уровень: Стандарт</option>
              <option value="pro">Уровень: Профи</option>
            </select>

            <input
              type="number"
              min={1}
              max={20}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              placeholder="Баллы"
              className="px-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <textarea
            rows={2}
            required
            value={questionMd}
            onChange={(e) => setQuestionMd(e.target.value)}
            placeholder="Условие задачи (можно с формулами, например: Найдите $\frac{3}{4}$ от 60)"
            className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
          />

          {hwType === 'test' && (
            <input
              type="text"
              required
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="Варианты через точку с запятой (например: 15; 30; 45; 60)"
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          )}

          {hwType !== 'open' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                placeholder="Правильный ответ (хранится закрыто на сервере)"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
              <input
                type="text"
                value={solutionHint}
                onChange={(e) => setSolutionHint(e.target.value)}
                placeholder="Подсказка при ошибке (необязательно)"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="btn-tactile px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 disabled:opacity-60 text-white text-xs sm:text-sm font-bold shadow-xs transition"
          >
            {creating ? 'Сохраняем...' : '+ Добавить домашнее задание'}
          </button>
        </form>
      )}
    </div>
  );
}