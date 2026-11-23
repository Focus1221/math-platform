'use client';

import { useEffect } from 'react';

interface Props {
  title: string;
  url: string;
  onClose: () => void;
}

function resolveEmbed(rawUrl: string): {
  mode: 'image' | 'iframe';
  embedUrl: string;
} {
  const url = rawUrl.trim();
  const lower = url.toLowerCase();

  // Картинки
  if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(lower)) {
    return { mode: 'image', embedUrl: url };
  }

  // YouTube (обычные ссылки, youtu.be, shorts)
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  if (ytMatch?.[1]) {
    return {
      mode: 'iframe',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
    };
  }

  // Google Slides / Docs
  if (lower.includes('docs.google.com/presentation/d/')) {
    const clean = url.replace(/\/(edit|view).*$/, '/embed?start=false&loop=false');
    return { mode: 'iframe', embedUrl: clean };
  }
  if (lower.includes('drive.google.com/file/d/')) {
    const clean = url.replace(/\/(view|edit).*$/, '/preview');
    return { mode: 'iframe', embedUrl: clean };
  }

  // Canva
  if (lower.includes('canva.com/design/') && !lower.includes('embed')) {
    const sep = url.includes('?') ? '&' : '?';
    return { mode: 'iframe', embedUrl: `${url}${sep}embed` };
  }

  // PDF, GeoGebra и остальные embed-ссылки
  return { mode: 'iframe', embedUrl: url };
}

export default function MaterialPreviewModal({ title, url, onClose }: Props) {
  const { mode, embedUrl } = resolveEmbed(url);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl h-[86vh] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-pop"
      >
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase text-indigo-600">
              Встроенный просмотр
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
              {title}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-bold transition"
            >
              Открыть отдельно ↗
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-extrabold transition"
              title="Закрыть"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center">
          {mode === 'image' ? (
            <img
              src={embedUrl}
              alt={title}
              className="max-w-full max-h-full object-contain p-3"
            />
          ) : (
            <iframe
              src={embedUrl}
              title={title}
              className="w-full h-full border-0 bg-white"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          )}
        </div>
      </div>
    </div>
  );
}