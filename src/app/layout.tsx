import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'MathHub — Интерактивная математика',
  description:
    'Интерактивная платформа по математике: наглядные уроки, тренажёры, ДЗ с автопроверкой и ИИ-помощник Сократ.',
};

const THEME_INIT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('mathhub_theme');
    if (t === 'mint' || t === 'cosmos' || t === 'bright') {
      document.documentElement.setAttribute('data-theme', t);
    } else {
      document.documentElement.setAttribute('data-theme', 'bright');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${inter.className} antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  );
}