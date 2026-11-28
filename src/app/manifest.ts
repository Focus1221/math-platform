import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MathHub — Интерактивная математика',
    short_name: 'MathHub',
    description:
      'Интерактивная платформа по математике: наглядные уроки, тренажёры, ДЗ с автопроверкой и ИИ-помощник Сократ.',
    start_url: '/today',
    display: 'standalone',
    background_color: '#0B211B',
    theme_color: '#0284C7',
    lang: 'ru',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}