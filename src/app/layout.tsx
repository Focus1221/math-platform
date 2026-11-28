import type { Metadata } from 'next';
import {
  Golos_Text,
  JetBrains_Mono,
  Manrope,
  Nunito,
  Unbounded,
} from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';
import ThemeBackdrop from '@/components/layout/ThemeBackdrop';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
});

const nunito = Nunito({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600', '700', '800', '900'],
  variable: '--font-nunito',
});

const golos = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-golos',
});

const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['600', '700', '800'],
  variable: '--font-unbounded',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '700', '800'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'MathHub — Интерактивная математика',
  description:
    'Интерактивная платформа по математике: наглядные уроки, тренажёры, ДЗ с автопроверкой и ИИ-помощник Сократ.',
};

const THEME_INIT_SCRIPT = `
(function(){
  try {
    var legacy = {
      bright: 'ocean',
      lab: 'ocean',
      academy: 'ocean',
      mint: 'chalk',
      focus: 'sunset',
      zine: 'comic',
      blueprint: 'cosmos'
    };
    var valid = { ocean: 1, chalk: 1, sunset: 1, comic: 1, cosmos: 1 };
    var raw = localStorage.getItem('mathhub_theme');
    var t = legacy[raw] || (valid[raw] ? raw : 'ocean');
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${manrope.variable} ${nunito.variable} ${golos.variable} ${unbounded.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased min-h-screen overflow-x-clip">
        <ThemeBackdrop />
        <div className="relative z-10 min-h-screen">{children}</div>
      </body>
    </html>
  );
}