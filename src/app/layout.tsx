import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'MathHub · Универсальная платформа по математике',
  description: 'Интерактивное обучение математике для 5–11 классов',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${inter.className} bg-[#F6F7FB] text-slate-800 antialiased`}>
        {children}
      </body>
    </html>
  );
}