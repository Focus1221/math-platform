'use client';

import { useEffect, useMemo, useState } from 'react';
import MathMarkdown from './MathMarkdown';
import SlideVisualBox from './SlideVisualBox';
import { playSound } from '@/lib/audio/sound';
import type { LessonSlide, SlideType, Topic } from '@/types/db';

interface Props {
  topic: Topic;
  boardMode?: boolean;
  isTeacherView?: boolean;
  onSlidesCompleted?: () => void;
  onGoToPractice?: () => void;
}

const SLIDE_META: Record<
  SlideType,
  { icon: string; badge: string; badgeCls: string; accentBorder: string }
> = {
  intro: {
    icon: '🚀',
    badge: 'Зачем это нужно',
    badgeCls: 'bg-sky-100 text-sky-800',
    accentBorder: 'border-sky-200',
  },
  concept: {
    icon: '💡',
    badge: 'Главное правило',
    badgeCls: 'bg-indigo-100 text-indigo-800',
    accentBorder: 'border-indigo-200',
  },
  example: {
    icon: '👀',
    badge: 'Пошаговый разбор',
    badgeCls: 'bg-emerald-100 text-emerald-800',
    accentBorder: 'border-emerald-200',
  },
  trap: {
    icon: '⚠️',
    badge: 'Осторожно, ловушка!',
    badgeCls: 'bg-amber-100 text-amber-900',
    accentBorder: 'border-amber-300',
  },
  quiz: {
    icon: '🎯',
    badge: 'Мини-проверка',
    badgeCls: 'bg-violet-100 text-violet-800',
    accentBorder: 'border-violet-300',
  },
  summary: {
    icon: '⭐',
    badge: 'Шпаргалка урока',
    badgeCls: 'bg-emerald-100 text-emerald-800',
    accentBorder: 'border-emerald-300',
  },
};

/** Если у урока ещё нет сохранённых слайдов — аккуратно разбиваем конспект по заголовкам ### */
function buildFallbackSlides(topic: Topic): LessonSlide[] {
  const md = (topic.theory_md || '').trim();
  if (!md) {
    return [
      {
        id: 'empty-1',
        type: 'intro',
        title: topic.title,
        body_md:
          topic.value_example ||
          'Конспект и презентация для этого урока скоро появятся. Загляни во вкладку «2. Потренироваться»!',
      },
    ];
  }

  const chunks = md
    .split(/\n(?=###\s+)/)
    .map((c) => c.trim())
    .filter(Boolean);

  return chunks.map((chunk, idx) => {
    const lines = chunk.split('\n');
    let title = idx === 0 ? topic.title : `Шаг ${idx + 1}`;
    let body = chunk;

    if (lines[0]?.startsWith('###')) {
      title = lines[0].replace(/^###\s*/, '').trim();
      body = lines.slice(1).join('\n').trim() || title;
    }

    const lower = title.toLowerCase();
    let type: SlideType = idx === 0 ? 'intro' : 'concept';
    if (lower.includes('пример') || lower.includes('разбор')) type = 'example';
    if (lower.includes('ошибк') || lower.includes('ловушк') || lower.includes('важно')) {
      type = 'trap';
    }
    if (idx === chunks.length - 1 && chunks.length > 2) type = 'summary';

    return {
      id: `auto-${idx}`,
      type,
      title,
      body_md: body,
    };
  });
}

export default function LessonSlidesPlayer({
  topic,
  boardMode = false,
  isTeacherView = false,
}: Props) {
  const hasRichSlides = Array.isArray(topic.slides) && topic.slides.length > 0;
  const slides = useMemo(
    () => (hasRichSlides ? (topic.slides as LessonSlide[]) : buildFallbackSlides(topic)),
    [hasRichSlides, topic]
  );

  const [viewMode, setViewMode] = useState<'slides' | 'full'>('slides');
  const [index, setIndex] = useState(0);
  const [revealedSteps, setRevealedSteps] = useState<Record<string, number>>({});
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [completedDeck, setCompletedDeck] = useState(false);

  // Сбрасываем на 1-й слайд при смене темы
  useEffect(() => {
    setIndex(0);
    setRevealedSteps({});
    setQuizAnswers({});
    setCompletedDeck(false);
  }, [topic.id, slides.length]);

  const safeIndex = Math.min(index, Math.max(0, slides.length - 1));
  const slide = slides[safeIndex];
  const meta = SLIDE_META[slide?.type || 'concept'] || SLIDE_META.concept;

  // Листание стрелками на клавиатуре (удобно на ноутбуке и проекторе)
  useEffect(() => {
    if (viewMode !== 'slides') return;
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') {
        setIndex((i) => Math.min(slides.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        setIndex((i) => Math.max(0, i - 1));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode, slides.length]);

  function goPrev() {
    if (safeIndex <= 0) return;
    playSound('click');
    setIndex(safeIndex - 1);
  }

  function goNext() {
    if (safeIndex >= slides.length - 1) {
      playSound('celebrate');
      setCompletedDeck(true);
      return;
    }
    playSound('click');
    setIndex(safeIndex + 1);
  }

  function handleSelectQuiz(slideId: string, optionIdx: number, correctIdx: number) {
    setQuizAnswers((prev) => ({ ...prev, [slideId]: optionIdx }));
    if (optionIdx === correctIdx) {
      playSound('success');
    } else {
      playSound('error');
    }
  }

  if (!slide) return null;

  const progressPct = Math.round(((safeIndex + 1) / slides.length) * 100);
  const steps = slide.steps || [];
  const shownStepsCount = revealedSteps[slide.id] ?? 1;
  const chosenQuizOpt = quizAnswers[slide.id];
  const quizCorrectIdx = slide.quiz_correct_index ?? 0;

  return (
    <div className="space-y-4">
      {/* Верхняя панель управления: прогресс-бар и переключение Слайды / Конспект */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                playSound('click');
                setViewMode('slides');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition ${
                viewMode === 'slides'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              🎬 Презентация ({slides.length})
            </button>
            <button
              type="button"
              onClick={() => {
                playSound('click');
                setViewMode('full');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition ${
                viewMode === 'full'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              📄 Весь конспект
            </button>
          </div>

          {!hasRichSlides && isTeacherView && (
            <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-200 text-[11px] font-bold text-violet-700">
              Автослайды · Нажми «✨ Собрать презентацию» ниже
            </span>
          )}
        </div>

        {viewMode === 'slides' && (
          <span className="text-xs font-extrabold text-slate-500 tabular-nums">
            Слайд {safeIndex + 1} из {slides.length}
          </span>
        )}
      </div>

      {/* РЕЖИМ 1: ИНТЕРАКТИВНЫЕ СЛАЙДЫ */}
      {viewMode === 'slides' ? (
        <div className="space-y-4">
          {/* Полоска прогресса с кликабельными сегментами */}
          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => {
              const isCurrent = i === safeIndex;
              const isPast = i < safeIndex;
              const isQuiz = s.type === 'quiz';
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    playSound('click');
                    setIndex(i);
                  }}
                  title={`Слайд ${i + 1}: ${s.title}`}
                  className={`h-2.5 flex-1 rounded-full transition-all ${
                    isCurrent
                      ? isQuiz
                        ? 'bg-violet-600 scale-y-125'
                        : 'bg-indigo-600 scale-y-125'
                      : isPast
                        ? 'bg-emerald-400 hover:bg-emerald-500'
                        : 'bg-slate-200 hover:bg-slate-300'
                  }`}
                />
              );
            })}
          </div>

          {/* Карточка текущего слайда */}
          <div
            key={slide.id}
            className={`rounded-3xl bg-white border-2 ${meta.accentBorder} p-5 sm:p-7 shadow-xs space-y-5 animate-pop min-h-[320px] flex flex-col justify-between`}
          >
            <div className="space-y-4">
              {/* Бейдж типа слайда и заголовок */}
              <div className="space-y-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${meta.badgeCls}`}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.badge}</span>
                </span>
                <h3
                  className={`font-extrabold text-slate-900 leading-tight ${
                    boardMode ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                  }`}
                >
                  {slide.title}
                </h3>
              </div>

              {/* Основной текст слайда */}
              {slide.body_md && (
                <MathMarkdown content={slide.body_md} large={boardMode} />
              )}

              {/* Встроенная наглядная схема / иллюстрация */}
              {slide.visual && (
                <SlideVisualBox visual={slide.visual} large={boardMode} />
              )}

              {/* Пошаговое раскрытие для примеров (type === 'example' или есть steps) */}
              {steps.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  {steps.slice(0, shownStepsCount).map((stepText, stepIdx) => (
                    <div
                      key={stepIdx}
                      className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 animate-pop"
                    >
                      <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                        {stepIdx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <MathMarkdown content={stepText} large={boardMode} />
                      </div>
                    </div>
                  ))}

                  {shownStepsCount < steps.length && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          playSound('click');
                          setRevealedSteps((prev) => ({
                            ...prev,
                            [slide.id]: shownStepsCount + 1,
                          }));
                        }}
                        className="btn-tactile px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 border-emerald-800 text-white text-xs sm:text-sm font-extrabold"
                      >
                        👀 Показать шаг {shownStepsCount + 1} из {steps.length}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playSound('click');
                          setRevealedSteps((prev) => ({
                            ...prev,
                            [slide.id]: steps.length,
                          }));
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold"
                      >
                        Открыть все шаги
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Карточки «Ловушка»: ❌ Неверно vs ✅ Верно */}
              {(slide.wrong_md || slide.right_md) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {slide.wrong_md && (
                    <div className="rounded-2xl bg-rose-50 border-2 border-rose-200 p-4 space-y-1.5">
                      <div className="text-xs font-extrabold uppercase text-rose-700">
                        ❌ Частая ошибка
                      </div>
                      <MathMarkdown content={slide.wrong_md} large={boardMode} />
                    </div>
                  )}
                  {slide.right_md && (
                    <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 p-4 space-y-1.5">
                      <div className="text-xs font-extrabold uppercase text-emerald-700">
                        ✅ Как правильно
                      </div>
                      <MathMarkdown content={slide.right_md} large={boardMode} />
                    </div>
                  )}
                </div>
              )}

              {/* Интерактивная мини-проверка прямо внутри слайда */}
              {slide.type === 'quiz' &&
                slide.quiz_options &&
                slide.quiz_options.length > 0 && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {slide.quiz_options.map((opt, optIdx) => {
                        const isPicked = chosenQuizOpt === optIdx;
                        const isRight = optIdx === quizCorrectIdx;
                        let btnStyle =
                          'bg-slate-50 border-slate-200 hover:border-violet-400 text-slate-800';
                        if (isPicked && isRight) {
                          btnStyle =
                            'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-200';
                        } else if (isPicked && !isRight) {
                          btnStyle =
                            'bg-rose-50 border-rose-500 text-rose-900 animate-shake';
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() =>
                              handleSelectQuiz(slide.id, optIdx, quizCorrectIdx)
                            }
                            className={`text-left p-4 rounded-2xl border-2 font-bold transition flex items-center gap-3 ${
                              boardMode ? 'text-base sm:text-lg' : 'text-sm'
                            } ${btnStyle}`}
                          >
                            <span className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs font-extrabold text-slate-600 shrink-0">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="flex-1">
                              <MathMarkdown content={opt} inline />
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {chosenQuizOpt !== undefined && (
                      <div
                        className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-semibold animate-pop ${
                          chosenQuizOpt === quizCorrectIdx
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="font-extrabold mb-0.5">
                          {chosenQuizOpt === quizCorrectIdx
                            ? '🎉 Точно в цель!'
                            : '🤔 Почти! Попробуй другой вариант.'}
                        </div>
                        {chosenQuizOpt === quizCorrectIdx &&
                          slide.quiz_explanation && (
                            <MathMarkdown content={slide.quiz_explanation} />
                          )}
                      </div>
                    )}
                  </div>
                )}

              {/* Шпаргалка (итоговые пункты) */}
              {slide.takeaways && slide.takeaways.length > 0 && (
                <div className="space-y-2 pt-1">
                  {slide.takeaways.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200"
                    >
                      <span className="text-emerald-600 font-extrabold text-base leading-none mt-0.5">
                        ✓
                      </span>
                      <div className="flex-1 min-w-0">
                        <MathMarkdown content={item} large={boardMode} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Удобная нижняя панель листания прямо под рукой */}
            <div className="pt-5 mt-2 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={goPrev}
                disabled={safeIndex === 0}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 disabled:opacity-35 text-slate-700 text-xs sm:text-sm font-extrabold transition"
              >
                ← Назад
              </button>

              <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-400 tabular-nums">
                <span>{progressPct}% изучено</span>
              </div>

              <button
                type="button"
                onClick={goNext}
                className={`btn-tactile px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold text-white transition ${
                  safeIndex === slides.length - 1
                    ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-800'
                    : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-800'
                }`}
              >
                {safeIndex === slides.length - 1
                  ? '🎉 Завершить слайды'
                  : 'Дальше →'}
              </button>
            </div>
          </div>

          {/* Баннер поздравления после завершения слайдов */}
          {completedDeck && (
            <div className="rounded-3xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-pop">
              <div className="space-y-0.5">
                <div className="text-base sm:text-lg font-extrabold">
                  🏆 Отличная работа! Теория пройдена
                </div>
                <p className="text-xs sm:text-sm text-emerald-50">
                  Теперь закрепи знания в шаге «🎮 2. Потренироваться» или переходи к «📝 3. Сдать ДЗ».
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCompletedDeck(false);
                  setIndex(0);
                }}
                className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-extrabold shrink-0 transition"
              >
                ↻ Повторить с 1-го слайда
              </button>
            </div>
          )}
        </div>
      ) : (
        /* РЕЖИМ 2: ВЕСЬ КОНСПЕКТ ОДНИМ ЛИСТОМ */
        <div className="space-y-4">
          {hasRichSlides ? (
            slides.map((s, i) => (
              <div
                key={s.id}
                className="rounded-2xl bg-slate-50/70 border border-slate-200 p-4 sm:p-5 space-y-3"
              >
                <div className="text-xs font-extrabold text-indigo-600">
                  {i + 1}. {SLIDE_META[s.type]?.icon} {s.title}
                </div>
                {s.body_md && <MathMarkdown content={s.body_md} large={boardMode} />}
                {s.visual && <SlideVisualBox visual={s.visual} large={boardMode} />}
                {s.steps && s.steps.length > 0 && (
                  <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700">
                    {s.steps.map((st, idx) => (
                      <li key={idx}>
                        <MathMarkdown content={st} inline />
                      </li>
                    ))}
                  </ol>
                )}
                {s.takeaways && s.takeaways.length > 0 && (
                  <ul className="space-y-1 text-sm text-slate-700">
                    {s.takeaways.map((tk, idx) => (
                      <li key={idx}>
                        ✓ <MathMarkdown content={tk} inline />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          ) : (
            <MathMarkdown content={topic.theory_md || ''} large={boardMode} />
          )}
        </div>
      )}
    </div>
  );
}