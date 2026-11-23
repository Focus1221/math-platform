'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import MathMarkdown from './MathMarkdown';
import type { Material, Topic } from '@/types/db';
import LessonSlidesPlayer from './LessonSlidesPlayer';
import SlideStudioPanel from './SlideStudioPanel';
interface Props {
  topic: Topic;
  materials: Material[];
  canEdit: boolean;
  boardMode?: boolean;
  onTopicUpdated: (updated: Topic) => void;
  onMaterialsChanged: (next: Material[]) => void;
}

const KIND_META: Record<string, { label: string; icon: string; cls: string }> = {
  presentation: {
    label: 'Презентация',
    icon: '📊',
    cls: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  pdf: {
    label: 'PDF / Документ',
    icon: '📄',
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  video: {
    label: 'Видеоурок',
    icon: '🎬',
    cls: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  link: {
    label: 'Ссылка',
    icon: '🔗',
    cls: 'bg-sky-50 text-sky-700 border-sky-200',
  },
};

// В аргументах функции:
export default function TheoryTab({
  topic,
  materials,
  canEdit,
  boardMode = false,
  onTopicUpdated,
  onMaterialsChanged,
}: Props) {
  const supabase = createClient();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(topic.theory_md || '');
  const [savingTheory, setSavingTheory] = useState(false);

  const [kind, setKind] = useState<'presentation' | 'pdf' | 'video' | 'link'>(
    'presentation'
  );
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Синхронизируем черновик при переключении на другую тему
  useEffect(() => {
    setDraft(topic.theory_md || '');
    setEditing(false);
  }, [topic.id, topic.theory_md]);

  const visibleMaterials = materials.filter((m) => m.kind !== 'iframe_game');

  async function saveTheory() {
    setSavingTheory(true);
    const { data, error } = await supabase
      .from('topics')
      .update({ theory_md: draft })
      .eq('id', topic.id)
      .select()
      .single();

    if (!error && data) {
      onTopicUpdated(data as Topic);
      setEditing(false);
    } else if (error) {
      alert('Ошибка сохранения конспекта: ' + error.message);
    }
    setSavingTheory(false);
  }

  async function handleAddMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setUploading(true);

    let storagePath: string | null = null;
    let fileName: string | null = null;
    let finalUrl: string | null = url.trim() || null;

    if (file) {
      const ext = file.name.split('.').pop() || 'bin';
      const safePath = `${topic.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('lesson-materials')
        .upload(safePath, file);

      if (upErr) {
        alert('Ошибка загрузки файла: ' + upErr.message);
        setUploading(false);
        return;
      }

      storagePath = safePath;
      fileName = file.name;
      const { data: pub } = supabase.storage
        .from('lesson-materials')
        .getPublicUrl(safePath);
      finalUrl = pub.publicUrl;
    }

    const { data, error } = await supabase
      .from('materials')
      .insert({
        topic_id: topic.id,
        kind,
        title: title.trim(),
        description: desc.trim(),
        url: finalUrl,
        storage_path: storagePath,
        file_name: fileName,
      })
      .select()
      .single();

    if (!error && data) {
      onMaterialsChanged([...materials, data as Material]);
      setTitle('');
      setUrl('');
      setDesc('');
      setFile(null);
    } else if (error) {
      alert('Ошибка добавления материала: ' + error.message);
    }
    setUploading(false);
  }

  async function handleDeleteMaterial(m: Material) {
    if (m.storage_path) {
      await supabase.storage.from('lesson-materials').remove([m.storage_path]);
    }
    const { error } = await supabase.from('materials').delete().eq('id', m.id);
    if (!error) {
      onMaterialsChanged(materials.filter((item) => item.id !== m.id));
    }
  }

  const hideEmptyMaterials = boardMode && !canEdit && visibleMaterials.length === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Левая колонка: Конспект */}
      <div
        className={`${
          hideEmptyMaterials ? 'lg:col-span-3' : 'lg:col-span-2'
        } bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            📘 Конспект урока
          </h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setDraft(topic.theory_md || '');
                setEditing((v) => !v);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
            >
              {editing ? 'Отмена' : '✏️ Редактировать'}
            </button>
          )}
        </div>

        {canEdit && editing ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Поддерживается Markdown и формулы LaTeX, например{' '}
              <code>{'$\\frac{3}{4} + \\sqrt{x}$'}</code>.
            </p>
            <textarea
              rows={14}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full p-3.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-2xl focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={savingTheory}
                onClick={saveTheory}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold transition"
              >
                {savingTheory ? 'Сохранение...' : '💾 Сохранить конспект'}
              </button>
            </div>
          </div>
       ) : (
          <div className="space-y-4">
            <LessonSlidesPlayer
              topic={topic}
              boardMode={boardMode}
              isTeacherView={canEdit}
            />
            {canEdit && (
              <SlideStudioPanel
                topic={topic}
                onTopicUpdated={onTopicUpdated}
              />
            )}
          </div>
        )}
      </div>


      {/* Правая колонка: Файлы и презентации */}
      {!hideEmptyMaterials && (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4 h-fit">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            📎 Материалы к уроку
          </h3>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {visibleMaterials.length}
          </span>
        </div>

        {visibleMaterials.length === 0 ? (
          <div className="text-center py-6 px-3 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
            Файлы и презентации к этой теме пока не добавлены.
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleMaterials.map((m) => {
              const meta = KIND_META[m.kind] || KIND_META.link;
              return (
                <div
                  key={m.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${meta.cls}`}
                    >
                      {meta.icon} {meta.label}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMaterial(m)}
                        className="text-xs font-bold text-slate-400 hover:text-rose-600"
                        title="Удалить материал"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="text-sm font-bold text-slate-900">{m.title}</div>
                  {m.description && (
                    <p className="text-xs text-slate-500">{m.description}</p>
                  )}
                  {m.url && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold transition"
                    >
                      {m.file_name
                        ? `⬇ Скачать (${m.file_name})`
                        : '↗ Открыть материал'}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {canEdit && (
          <form
            onSubmit={handleAddMaterial}
            className="pt-4 border-t border-slate-100 space-y-2.5"
          >
            <div className="text-xs font-bold text-indigo-700 uppercase">
              + Загрузить материал
            </div>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="presentation">📊 Презентация (PPTX / PDF)</option>
              <option value="pdf">📄 Документ / PDF / DOCX</option>
              <option value="video">🎬 Видеоурок (ссылка)</option>
              <option value="link">🔗 Полезная ссылка</option>
            </select>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название материала"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Ссылка (или загрузи файл ниже)"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-[11px] text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-semibold"
            />
            <textarea
              rows={2}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Краткое описание..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
            <button
              type="submit"
              disabled={uploading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold transition"
            >
              {uploading ? 'Загрузка в облако...' : 'Прикрепить к уроку'}
            </button>
          </form>
        )}
      </div>
    )}</div>
  );
}