'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';

export interface PrintableCard {
  studentId: string;
  fullName: string;
  loginUsername: string;
  pinCode: string;
}

interface Props {
  classroomName: string;
  cards: PrintableCard[];
}

export default function PrintCardsClient({ classroomName, cards }: Props) {
  const [origin, setOrigin] = useState('https://math-platform-pink.vercel.app');
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const currentOrigin = window.location.origin;
    setOrigin(currentOrigin);

    let cancelled = false;
    async function generateAll() {
      const next: Record<string, string> = {};
      for (const card of cards) {
        const url = `${currentOrigin}/login?u=${encodeURIComponent(card.loginUsername)}`;
        try {
          next[card.studentId] = await QRCode.toDataURL(url, {
            width: 140,
            margin: 1,
            color: { dark: '#0F172A', light: '#FFFFFF' },
          });
        } catch {
          // Игнорируем единичную ошибку генерации
        }
      }
      if (!cancelled) setQrMap(next);
    }

    generateAll();
    return () => {
      cancelled = true;
    };
  }, [cards]);

  const cleanHost = origin.replace(/^https?:\/\//, '');

  return (
    <div className="min-h-screen bg-[#F6F7FB] print:bg-white">
      {/* Верхняя панель (скрывается при печати) */}
      <div className="print:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900">
              🖨️ Карточки входа — {classroomName}
            </h1>
            <p className="text-xs text-slate-500">
              Карточек: <strong>{cards.length}</strong> · Формат A4, удобно разрезать и вклеить в тетрадь
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/teacher/journal"
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
            >
              ← В журнал
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={cards.length === 0}
              className="btn-tactile px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 border-indigo-800 disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold"
            >
              🖨️ Распечатать / Сохранить в PDF
            </button>
          </div>
        </div>
      </div>

      {/* Сетка карточек */}
      <main className="max-w-5xl mx-auto p-4 sm:p-6 print:p-0 print:max-w-none">
        {cards.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-2">
            <div className="text-3xl">🪪</div>
            <h2 className="text-base font-extrabold text-slate-900">
              В классе {classroomName} пока нет учеников с PIN-карточками
            </h2>
            <p className="text-xs text-slate-500">
              Вернись в «Журнал → Классы и ученики» и добавь учеников списком.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
            {cards.map((card) => (
              <div
                key={card.studentId}
                className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-4 flex items-center justify-between gap-3 break-inside-avoid print:rounded-xl print:border-slate-400 print:p-3"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-extrabold print:bg-slate-900">
                      MathHub · {classroomName}
                    </span>
                  </div>

                  <div className="text-base font-extrabold text-slate-900 leading-tight truncate">
                    {card.fullName}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[10px] font-bold uppercase text-slate-400">
                        Логин
                      </div>
                      <div className="font-mono text-sm font-extrabold text-slate-900 break-all">
                        {card.loginUsername}
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-indigo-50/70 border border-indigo-200">
                      <div className="text-[10px] font-bold uppercase text-indigo-500">
                        PIN-код
                      </div>
                      <div className="font-mono text-base font-extrabold text-indigo-800 tracking-widest">
                        {card.pinCode}
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] font-semibold text-slate-500 truncate">
                    Сайт: <span className="text-slate-700 font-bold">{cleanHost}</span>
                  </div>
                </div>

                {/* QR-код */}
                <div className="shrink-0 flex flex-col items-center gap-1">
                  {qrMap[card.studentId] ? (
                    <img
                      src={qrMap[card.studentId]}
                      alt={`QR ${card.loginUsername}`}
                      className="w-24 h-24 rounded-xl border border-slate-200"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-slate-100 border border-slate-200" />
                  )}
                  <span className="text-[9px] font-bold text-slate-400">
                    Сканируй камерой
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}