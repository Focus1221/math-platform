'use client';

import { useEffect, useState } from 'react';
import MathMarkdown from './MathMarkdown';
import type { Profile, Topic } from '@/types/db';

type TutorMode = 'socratic' | 'error' | 'analog' | 'visual';

interface ChatMessage {
  id: string;
  modeLabel: string;
  text: string;
  time: string;
}

interface Props {
  topic: Topic;
  profile: Profile | null;
  onGoToTheory: () => void;
}

const MODES: { mode: TutorMode; icon: string; label: string; sub: string }[] = [
  { mode: 'socratic', icon: '❓', label: 'Наводящий вопрос', sub: 'Подтолкнёт к идее' },
  { mode: 'error', icon: '🔎', label: 'Найди мою ошибку', sub: 'Проверит алгоритм' },
  { mode: 'analog', icon: '🔄', label: 'Похожая задача', sub: 'Покажет аналог' },
  { mode: 'visual', icon: '🎨', label: 'Объясни нагляднее', sub: 'Образный пример' },
];

export default function AiTutorTab({ topic, profile, onGoToTheory }: Props) {
  const [problem, setProblem] = useState('');
  const [attempt, setAttempt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    setProblem('');
    setAttempt('');
    setMessages([]);
    setErrorText('');
  }, [topic.id]);

  // Блокировка на СОР и СОЧ
  if (topic.is_assessment) {
    return (
      <div className="bg-white rounded-3xl border-2 border-amber-200 shadow-xs p-8 sm:p-10 text-center max-w-2xl mx-auto space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-3xl">
          🔒
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
          ⚖️ Режим академической честности («Адал азамат»)
        </div>
        <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
          ИИ-помощник отключён на СОР и СОЧ
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          Во время суммативного оценивания (СОР и СОЧ) ИИ-тьютор недоступен. Выполняй работу самостоятельно, чтобы увидеть свой реальный уровень.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onGoToTheory}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs sm:text-sm font-bold transition"
          >
            Вернуться к конспекту
          </button>
        </div>
      </div>
    );
  }

  const ready = problem.trim().length >= 3 && attempt.trim().length >= 3 && !loading;

  async function askTutor(mode: TutorMode) {
    if (!profile) {
      setErrorText('Сначала войди в аккаунт, чтобы задать вопрос ИИ-тьютору.');
      return;
    }

    setLoading(true);
    setErrorText('');
    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: topic.id,
          problem,
          attempt,
          mode,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorText(data.error || 'Ошибка запроса к ИИ-тьютору.');
        return;
      }

      const now = new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setMessages((prev) => [
        {
          id: String(Date.now()),
          modeLabel: data.modeLabel,
          text: data.reply,
          time: now,
        },
        ...prev,
      ]);
    } catch {
      setErrorText('Сетевая ошибка. Проверь интернет-соединение.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center text-xl shrink-0 shadow-xs">
            🦉
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
              ИИ-Тьютор «Сократ»
            </h3>
            <p className="text-xs text-slate-500">
              Сначала твоя самостоятельная попытка → затем помощь без готового ответа.
            </p>
          </div>
        </div>

        {topic.value_example && (
          <button
            type="button"
            onClick={() => setProblem(topic.value_example)}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition shrink-0"
          >
            ✨ Вставить задачу по теме
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white inline-flex items-center justify-center text-[10px]">
              1
            </span>
            Условие задачи
          </label>
          <textarea
            rows={4}
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="Запиши условие задачи из учебника или тетради..."
            className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[10px]">
              2
            </span>
            Моя самостоятельная попытка <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={4}
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            placeholder="Напиши, как ты пробовал(а) решить задачу — даже если не уверен(а) в ответе!"
            className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Выбери одну функцию помощника:
          </span>
          {!ready && !loading ? (
            <span className="text-xs font-semibold text-amber-600">
              🔒 Заполни условие и свою попытку решения, чтобы открыть кнопки
            </span>
          ) : (
            <span className="text-xs font-semibold text-emerald-600">
              🔓 Помощник готов к работе
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              disabled={!ready}
              onClick={() => askTutor(m.mode)}
              className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                ready
                  ? 'bg-white border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50/60 shadow-xs cursor-pointer'
                  : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
              }`}
            >
              <span className="text-xl leading-none">{m.icon}</span>
              <div>
                <div className={`text-xs font-bold ${ready ? 'text-slate-900' : 'text-slate-500'}`}>
                  {m.label}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{m.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {errorText && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
          {errorText}
        </div>
      )}

      {loading && (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center gap-3 text-indigo-800 text-sm font-semibold">
          <span className="inline-block w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          Тьютор «Сократ» изучает твою попытку и готовит подсказку...
        </div>
      )}

      {messages.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Диалог с тьютором</span>
            <button
              type="button"
              onClick={() => setMessages([])}
              className="text-xs font-semibold text-slate-400 hover:text-rose-600"
            >
              Очистить
            </button>
          </div>

          {messages.map((m) => (
            <div
              key={m.id}
              className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-white border border-indigo-100 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-indigo-700">🦉 Сократ · {m.modeLabel}</span>
                <span className="text-slate-400">{m.time}</span>
              </div>
              <MathMarkdown content={m.text} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}