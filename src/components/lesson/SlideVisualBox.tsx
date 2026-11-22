'use client';

import MathMarkdown from './MathMarkdown';
import type { SlideVisual } from '@/types/db';

interface Props {
  visual: SlideVisual;
  large?: boolean;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export default function SlideVisualBox({ visual, large = false }: Props) {
  if (visual.kind === 'formula_hero') {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-5 sm:p-6 text-white text-center shadow-sm space-y-2">
        <div
          className={`font-extrabold [&_p]:text-white [&_strong]:text-white ${
            large ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
          }`}
        >
          <MathMarkdown content={visual.formula} inline />
        </div>
        {visual.caption && (
          <div className="text-xs sm:text-sm text-indigo-100 font-semibold">
            {visual.caption}
          </div>
        )}
      </div>
    );
  }

  if (visual.kind === 'fraction_bar') {
    const den = Math.round(clamp(visual.denominator, 1, 16));
    const num = Math.round(clamp(visual.numerator, 0, den));
    const hasCompare =
      typeof visual.compareDenominator === 'number' &&
      typeof visual.compareNumerator === 'number';
    const cDen = hasCompare
      ? Math.round(clamp(visual.compareDenominator!, 1, 16))
      : 1;
    const cNum = hasCompare
      ? Math.round(clamp(visual.compareNumerator!, 0, cDen))
      : 0;

    return (
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 sm:p-5 space-y-3">
        {visual.label && (
          <div className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 text-center">
            {visual.label}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>
              Закрашено {num} из {den} равных частей
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 font-extrabold">
              {num}/{den}
            </span>
          </div>
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${den}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: den }, (_, i) => (
              <div
                key={i}
                className={`h-11 sm:h-12 rounded-xl border-2 flex items-center justify-center text-xs font-extrabold transition ${
                  i < num
                    ? 'bg-gradient-to-b from-indigo-500 to-violet-600 border-indigo-700 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                {i < num ? '1/' + den : ''}
              </div>
            ))}
          </div>
        </div>

        {hasCompare && (
          <div className="space-y-2 pt-2 border-t border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>
                Сравним: {cNum} из {cDen} частей
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold">
                {cNum}/{cDen}
              </span>
            </div>
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${cDen}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: cDen }, (_, i) => (
                <div
                  key={i}
                  className={`h-11 sm:h-12 rounded-xl border-2 flex items-center justify-center text-xs font-extrabold transition ${
                    i < cNum
                      ? 'bg-gradient-to-b from-emerald-500 to-teal-600 border-emerald-700 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  {i < cNum ? '1/' + cDen : ''}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (visual.kind === 'number_line') {
    const min = Number.isFinite(visual.min) ? visual.min : 0;
    const rawMax = Number.isFinite(visual.max) ? visual.max : 10;
    const max = rawMax > min ? rawMax : min + 10;
    const span = max - min;
    const toX = (v: number) => 36 + ((clamp(v, min, max) - min) / span) * 448;

    const tickCount = Math.min(10, Math.max(4, Math.round(span)));
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
      const val = min + (span * i) / tickCount;
      return Number(val.toFixed(1));
    });

    const jump = visual.jump;
    const jFromX = jump ? toX(jump.from) : 0;
    const jToX = jump ? toX(jump.to) : 0;
    const jMidX = (jFromX + jToX) / 2;

    return (
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 overflow-x-auto">
        <svg viewBox="0 0 520 120" className="w-full min-w-[340px] max-w-xl mx-auto">
          {/* Луч и стрелка */}
          <line x1={28} y1={72} x2={498} y2={72} stroke="#475569" strokeWidth={3} strokeLinecap="round" />
          <polygon points="502,72 490,66 490,78" fill="#475569" />

          {/* Штрихи */}
          {ticks.map((val, idx) => {
            const x = toX(val);
            return (
              <g key={idx}>
                <line x1={x} y1={65} x2={x} y2={79} stroke="#94A3B8" strokeWidth={2} />
                <text
                  x={x}
                  y={98}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="#64748B"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Дуга прыжка */}
          {jump && (
            <g>
              <path
                d={`M ${jFromX} 64 Q ${jMidX} 16 ${jToX} 64`}
                fill="none"
                stroke="#10B981"
                strokeWidth={3}
                strokeDasharray="6 4"
              />
              {jump.label && (
                <text
                  x={jMidX}
                  y={24}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={800}
                  fill="#059669"
                >
                  {jump.label}
                </text>
              )}
            </g>
          )}

          {/* Выделенные точки */}
          {(visual.points || []).map((pt, i) => {
            const x = toX(pt.value);
            const hl = pt.highlight !== false;
            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={72}
                  r={hl ? 7 : 5}
                  fill={hl ? '#4F46E5' : '#0EA5E9'}
                  stroke="#FFFFFF"
                  strokeWidth={2.5}
                />
                <text
                  x={x}
                  y={52}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={800}
                  fill={hl ? '#4338CA' : '#0369A1'}
                >
                  {pt.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  if (visual.kind === 'percent_grid') {
    const pct = Math.round(clamp(visual.percent, 0, 100));
    return (
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-center gap-5">
        <div className="grid grid-cols-10 gap-1 p-2 rounded-xl bg-white border border-slate-200 shrink-0">
          {Array.from({ length: 100 }, (_, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[3px] ${
                i < pct ? 'bg-indigo-600' : 'bg-slate-100'
              }`}
            />
          ))}
        </div>
        <div className="space-y-1.5 text-center sm:text-left">
          <div className="text-3xl font-extrabold text-indigo-600 tabular-nums">
            {pct}%
          </div>
          <div className="text-xs sm:text-sm font-bold text-slate-700">
            {pct} из 100 клеток = {String(Number((pct / 100).toFixed(2))).replace('.', ',')}
          </div>
          {visual.label && (
            <div className="text-xs text-slate-500">{visual.label}</div>
          )}
        </div>
      </div>
    );
  }

  if (visual.kind === 'angle') {
    const deg = Math.round(clamp(visual.degrees, 5, 355));
    const cx = 130;
    const cy = 125;
    const r = 92;
    const arcR = 36;
    const rad = (deg * Math.PI) / 180;
    const x2 = cx + r * Math.cos(-rad);
    const y2 = cy + r * Math.sin(-rad);
    const ax = cx + arcR * Math.cos(-rad);
    const ay = cy + arcR * Math.sin(-rad);
    const largeArc = deg > 180 ? 1 : 0;
    const midRad = (deg / 2) * (Math.PI / 180);
    const lx = cx + 52 * Math.cos(-midRad);
    const ly = cy + 52 * Math.sin(-midRad);

    const angleKind =
      deg < 90
        ? 'Острый угол'
        : deg === 90
          ? 'Прямой угол'
          : deg < 180
            ? 'Тупой угол'
            : deg === 180
              ? 'Развёрнутый угол'
              : 'Угол больше 180°';

    return (
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-center gap-4">
        <svg viewBox="0 0 260 155" className="w-60 h-36 shrink-0">
          <path
            d={`M ${cx + arcR} ${cy} A ${arcR} ${arcR} 0 ${largeArc} 0 ${ax.toFixed(1)} ${ay.toFixed(1)}`}
            fill="none"
            stroke="#F59E0B"
            strokeWidth={4}
          />
          <line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke="#4F46E5" strokeWidth={3.5} strokeLinecap="round" />
          <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="#4F46E5" strokeWidth={3.5} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={5} fill="#0F172A" />
          <text x={lx} y={ly} textAnchor="middle" fontSize={13} fontWeight={800} fill="#B45309">
            {deg}°
          </text>
        </svg>
        <div className="text-center sm:text-left space-y-1">
          <div className="text-lg font-extrabold text-slate-900">
            {deg}° — {angleKind}
          </div>
          {visual.label && (
            <p className="text-xs sm:text-sm text-slate-600">{visual.label}</p>
          )}
        </div>
      </div>
    );
  }

  if (visual.kind === 'venn') {
    return (
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
        <svg viewBox="0 0 420 200" className="w-full max-w-md mx-auto">
          <circle cx={155} cy={108} r={74} fill="rgba(99, 102, 241, 0.18)" stroke="#4F46E5" strokeWidth={2.5} />
          <circle cx={265} cy={108} r={74} fill="rgba(16, 185, 129, 0.18)" stroke="#10B981" strokeWidth={2.5} />

          <text x={115} y={24} textAnchor="middle" fontSize={13} fontWeight={800} fill="#4338CA">
            {visual.leftLabel}
          </text>
          <text x={305} y={24} textAnchor="middle" fontSize={13} fontWeight={800} fill="#047857">
            {visual.rightLabel}
          </text>

          {(visual.leftItems || []).slice(0, 4).map((it, i) => (
            <text key={i} x={122} y={88 + i * 20} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1E293B">
              {it}
            </text>
          ))}
          {(visual.bothItems || []).slice(0, 4).map((it, i) => (
            <text key={i} x={210} y={88 + i * 20} textAnchor="middle" fontSize={12} fontWeight={800} fill="#4F46E5">
              {it}
            </text>
          ))}
          {(visual.rightItems || []).slice(0, 4).map((it, i) => (
            <text key={i} x={298} y={88 + i * 20} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1E293B">
              {it}
            </text>
          ))}
        </svg>
      </div>
    );
  }

  if (visual.kind === 'compare') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-indigo-50/70 border border-indigo-200 p-4 space-y-1.5">
          <div className="text-xs font-extrabold uppercase text-indigo-700">
            {visual.leftTitle}
          </div>
          <MathMarkdown content={visual.leftText} large={large} />
        </div>
        <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-4 space-y-1.5">
          <div className="text-xs font-extrabold uppercase text-emerald-700">
            {visual.rightTitle}
          </div>
          <MathMarkdown content={visual.rightText} large={large} />
        </div>
      </div>
    );
  }

  return null;
}