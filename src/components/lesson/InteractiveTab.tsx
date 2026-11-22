'use client';
import { playSound } from '@/lib/audio/sound';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import PercentGridSim from '@/components/simulators/PercentGridSim';
import DiagramsSim from '@/components/simulators/DiagramsSim';
import CoordRaySim from '@/components/simulators/CoordRaySim';
import DivisibilitySim from '@/components/simulators/DivisibilitySim';
import FractionsSim from '@/components/simulators/FractionsSim';
import ProtractorSim from '@/components/simulators/ProtractorSim';
import SetsVennSim from '@/components/simulators/SetsVennSim';
import TaskGeneratorSim from '@/components/simulators/TaskGeneratorSim';
import type { Material, Profile, Topic } from '@/types/db';

type SimId =
  | 'coord_ray'
  | 'divisibility'
  | 'fractions_visual'
  | 'angles'
  | 'sets'
  | 'percent_grid'
  | 'diagrams'
  | 'generator';

// 3. Добавь 2 кнопки в массив SIMULATORS:
const SIMULATORS: { id: SimId; name: string; icon: string }[] = [
  { id: 'coord_ray', name: 'Координатный луч', icon: '📏' },
  { id: 'divisibility', name: 'Блиц: Делимость', icon: '⚡' },
  { id: 'fractions_visual', name: 'Пицца дробей', icon: '🍕' },
  { id: 'angles', name: 'Транспортир', icon: '📐' },
  { id: 'sets', name: 'Эйлер–Венн', icon: '⭕' },
  { id: 'percent_grid', name: 'Проценты 10×10', icon: '💯' },
  { id: 'diagrams', name: 'Диаграммы', icon: '📊' },
  { id: 'generator', name: 'Генератор задач', icon: '🎲' },
];

// 4. Обнови resolveDefaultSim:
function resolveDefaultSim(simType: string): SimId {
  const direct: SimId[] = [
    'coord_ray',
    'divisibility',
    'fractions_visual',
    'angles',
    'sets',
    'percent_grid',
    'diagrams',
  ];
  return direct.includes(simType as SimId) ? (simType as SimId) : 'generator';
}

interface Props {
  topic: Topic;
  materials: Material[];
  canEdit: boolean;
  profile: Profile | null;
  isTopicCompleted: boolean;
  onMaterialsChanged: (next: Material[]) => void;
}

export default function InteractiveTab({
  topic,
  materials,
  canEdit,
  profile,
  isTopicCompleted,
  onMaterialsChanged,
}: Props) {
  const supabase = createClient();

  const [activeSim, setActiveSim] = useState<SimId>(() => resolveDefaultSim(topic.sim_type));
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);

  const [embedTitle, setEmbedTitle] = useState('');
  const [embedInput, setEmbedInput] = useState('');

  // При смене темы подбираем профильный симулятор и подгружаем счётчик ученика из БД
  useEffect(() => {
    setActiveSim(resolveDefaultSim(topic.sim_type));
    if (!profile) return;

    let cancelled = false;
    supabase
      .from('topic_progress')
      .select('sim_correct_count, sim_streak')
      .eq('student_id', profile.id)
      .eq('topic_id', topic.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) {
          setCorrectCount(data.sim_correct_count || 0);
          setStreak(data.sim_streak || 0);
        } else if (!cancelled) {
          setCorrectCount(0);
          setStreak(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [topic.id, topic.sim_type, profile?.id]);

  async function handleSimResult(isCorrect: boolean) {
    const nextCorrect = isCorrect ? correctCount + 1 : correctCount;
    const nextStreak = isCorrect ? streak + 1 : 0;
    setCorrectCount(nextCorrect);
    setStreak(nextStreak);
    if (isCorrect) {
      playSound(nextStreak > 0 && nextStreak % 5 === 0 ? 'celebrate' : 'success');
    } else {
      playSound('error');
    }

    if (!profile) return;
    await supabase.from('topic_progress').upsert({
      student_id: profile.id,
      topic_id: topic.id,
      completed: isTopicCompleted,
      sim_correct_count: nextCorrect,
      sim_streak: nextStreak,
      updated_at: new Date().toISOString(),
    });
  }

  async function handleAddEmbed(e: React.FormEvent) {
    e.preventDefault();
    if (!embedTitle.trim() || !embedInput.trim()) return;
    const match = embedInput.match(/src\s*=\s*["']([^"']+)["']/i);
    const src = match ? match[1] : embedInput.trim();
    if (!/^https?:\/\//i.test(src)) {
      alert('Укажите корректную ссылку https://... или код <iframe src="...">');
      return;
    }

    const { data, error } = await supabase
      .from('materials')
      .insert({
        topic_id: topic.id,
        kind: 'iframe_game',
        title: embedTitle.trim(),
        url: src,
      })
      .select()
      .single();

    if (!error && data) {
      onMaterialsChanged([...materials, data as Material]);
      setEmbedTitle('');
      setEmbedInput('');
    }
  }

  async function handleDeleteEmbed(id: string) {
    await supabase.from('materials').delete().eq('id', id);
    onMaterialsChanged(materials.filter((m) => m.id !== id));
  }

  const embeds = materials.filter((m) => m.kind === 'iframe_game');

  return (
    <div className="space-y-5">
      {/* Встроенные симуляторы */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Интерактивная лаборатория
            </h3>
            <p className="text-xs text-slate-500">
              Тренажёр подобран под текущую тему, но можно открыть любую песочницу.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-semibold">
            <span className="text-emerald-800">🏆 Решено: <strong>{correctCount}</strong></span>
            <span className="text-emerald-300">|</span>
            <span className="text-amber-700">🔥 Серия: <strong>{streak}</strong></span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {SIMULATORS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSim(s.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                activeSim === s.id
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <span>{s.icon}</span> {s.name}
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 sm:p-6">
          {activeSim === 'percent_grid' && <PercentGridSim onResult={handleSimResult} />}
          {activeSim === 'diagrams' && <DiagramsSim onResult={handleSimResult} />}
          {activeSim === 'coord_ray' && <CoordRaySim onResult={handleSimResult} />}
          {activeSim === 'divisibility' && <DivisibilitySim onResult={handleSimResult} />}
          {activeSim === 'fractions_visual' && <FractionsSim onResult={handleSimResult} />}
          {activeSim === 'angles' && <ProtractorSim onResult={handleSimResult} />}
          {activeSim === 'sets' && <SetsVennSim />}
          {activeSim === 'generator' && (
            <TaskGeneratorSim initialSimType={topic.sim_type} onResult={handleSimResult} />
          )}
        </div>
      </div>

      {/* Внешние игры */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            🕹️ Внешние игры (Wordwall, GeoGebra, LearningApps, Desmos)
          </h3>
          <p className="text-xs text-slate-500">
            Учитель может встроить готовую интерактивную игру по ссылке или iframe-коду.
          </p>
        </div>

        {embeds.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
            Внешние игры к этой теме пока не добавлены.
          </div>
        ) : (
          <div className="space-y-4">
            {embeds.map((em) => (
              <div key={em.id} className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-xs font-bold">
                  <span>{em.title}</span>
                  <div className="flex items-center gap-3">
                    <a
                      href={em.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      На весь экран ↗
                    </a>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDeleteEmbed(em.id)}
                        className="text-rose-600 hover:underline"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
                <div className="aspect-video bg-slate-100">
                  <iframe src={em.url || ''} className="w-full h-full border-0" allowFullScreen loading="lazy" />
                </div>
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <form onSubmit={handleAddEmbed} className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="text"
              required
              value={embedTitle}
              onChange={(e) => setEmbedTitle(e.target.value)}
              placeholder="Название игры (напр. Wordwall)"
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
            <input
              type="text"
              required
              value={embedInput}
              onChange={(e) => setEmbedInput(e.target.value)}
              placeholder="URL или код <iframe src='...'>"
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
            <button
              type="submit"
              className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
            >
              + Встроить игру
            </button>
          </form>
        )}
      </div>
    </div>
  );
}