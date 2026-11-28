'use client';

import { useRef, useState } from 'react';
import { GRID_STEP, type Point } from './boardTypes';

export interface RulerState {
  x: number;
  y: number;
  angle: number; // градусы
  length: number;
}

interface ProtractorState {
  cx: number;
  cy: number;
  angle: number;
}

interface CompassState {
  cx: number;
  cy: number;
  radius: number;
}

interface Props {
  showRuler: boolean;
  showProtractor: boolean;
  showCompass: boolean;
  ruler: RulerState;
  onRulerChange: (next: RulerState) => void;
  onCloseRuler: () => void;
  onCloseProtractor: () => void;
  onCloseCompass: () => void;
  onDrawCompassCircle: (center: Point, radius: number) => void;
}

const RULER_HEIGHT = 54;
const PROTRACTOR_R = 128;

/**
 * Если точка близко к верхнему краю линейки — проецирует её ровно на кромку.
 */
export function snapPointToRulerEdge(
  pt: Point,
  ruler: RulerState,
  threshold = 24
): { snapped: Point; onEdge: boolean } {
  const rad = (ruler.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const dx = pt.x - ruler.x;
  const dy = pt.y - ruler.y;

  const along = dx * cos + dy * sin;
  const perp = -dx * sin + dy * cos;

  if (along >= -14 && along <= ruler.length + 14 && Math.abs(perp) <= threshold) {
    const clampedAlong = Math.max(0, Math.min(ruler.length, along));
    return {
      snapped: {
        x: ruler.x + clampedAlong * cos,
        y: ruler.y + clampedAlong * sin,
      },
      onEdge: true,
    };
  }

  return { snapped: pt, onEdge: false };
}

function snapAngle(deg: number): number {
  const normalized = ((deg % 360) + 360) % 360;
  const step = 15;
  const nearest = Math.round(normalized / step) * step;
  if (Math.abs(normalized - nearest) <= 2.5) {
    return nearest % 360;
  }
  return Math.round(normalized);
}

export default function BoardGeoTools({
  showRuler,
  showProtractor,
  showCompass,
  ruler,
  onRulerChange,
  onCloseRuler,
  onCloseProtractor,
  onCloseCompass,
  onDrawCompassCircle,
}: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [protractor, setProtractor] = useState<ProtractorState>({
    cx: 260,
    cy: 260,
    angle: 0,
  });

  const [compass, setCompass] = useState<CompassState>({
    cx: 320,
    cy: 240,
    radius: GRID_STEP * 4,
  });

  const dragRef = useRef<{
    kind:
      | 'ruler-move'
      | 'ruler-rotate'
      | 'protractor-move'
      | 'protractor-rotate'
      | 'compass-move'
      | 'compass-radius';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origAngle: number;
    startPointerAngle: number;
  } | null>(null);

  function getPointerAngleFromPivot(
    clientX: number,
    clientY: number,
    pivotX: number,
    pivotY: number
  ): number {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    return (Math.atan2(py - pivotY, px - pivotX) * 180) / Math.PI;
  }

  function handlePointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (d.kind === 'ruler-move') {
      onRulerChange({
        ...ruler,
        x: d.origX + dx,
        y: d.origY + dy,
      });
    } else if (d.kind === 'ruler-rotate') {
      const currAngle = getPointerAngleFromPivot(e.clientX, e.clientY, ruler.x, ruler.y);
      const nextAngle = snapAngle(d.origAngle + (currAngle - d.startPointerAngle));
      onRulerChange({
        ...ruler,
        angle: nextAngle,
      });
    } else if (d.kind === 'protractor-move') {
      setProtractor((prev) => ({
        ...prev,
        cx: d.origX + dx,
        cy: d.origY + dy,
      }));
    } else if (d.kind === 'protractor-rotate') {
      const currAngle = getPointerAngleFromPivot(
        e.clientX,
        e.clientY,
        protractor.cx,
        protractor.cy
      );
      const nextAngle = snapAngle(d.origAngle + (currAngle - d.startPointerAngle));
      setProtractor((prev) => ({
        ...prev,
        angle: nextAngle,
      }));
    } else if (d.kind === 'compass-move') {
      setCompass((prev) => ({
        ...prev,
        cx: d.origX + dx,
        cy: d.origY + dy,
      }));
    } else if (d.kind === 'compass-radius') {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const dist = Math.hypot(px - compass.cx, py - compass.cy);
      const clamped = Math.max(GRID_STEP, Math.min(260, Math.round(dist)));
      setCompass((prev) => ({ ...prev, radius: clamped }));
    }
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragRef.current) return;
    e.stopPropagation();
    dragRef.current = null;
  }

  const cmCount = Math.floor(ruler.length / GRID_STEP);
  const compassCm = (compass.radius / GRID_STEP).toFixed(1).replace('.', ',');

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-10 pointer-events-none overflow-hidden select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* 1. ИНТЕРАКТИВНАЯ ЛИНЕЙКА */}
      {showRuler && (
        <div
          style={{
            left: ruler.x,
            top: ruler.y,
            width: ruler.length,
            height: RULER_HEIGHT,
            transform: `rotate(${ruler.angle}deg)`,
            transformOrigin: '0 0',
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            dragRef.current = {
              kind: 'ruler-move',
              startX: e.clientX,
              startY: e.clientY,
              origX: ruler.x,
              origY: ruler.y,
              origAngle: ruler.angle,
              startPointerAngle: 0,
            };
          }}
          className="absolute pointer-events-auto cursor-move rounded-b-xl border-2 border-amber-500/80 bg-amber-100/85 backdrop-blur-xs shadow-lg touch-none"
        >
          {/* Шкала сантиметров вдоль верхнего края */}
          <svg
            width={ruler.length}
            height={RULER_HEIGHT}
            className="block pointer-events-none"
          >
            {/* Подсветка рабочей кромки для рисования */}
            <line
              x1={0}
              y1={1}
              x2={ruler.length}
              y2={1}
              stroke="#EA580C"
              strokeWidth={3}
            />
            {Array.from({ length: cmCount * 2 + 1 }, (_, i) => {
              const x = (i * GRID_STEP) / 2;
              const isMajor = i % 2 === 0;
              return (
                <g key={i}>
                  <line
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={isMajor ? 16 : 9}
                    stroke="#78350F"
                    strokeWidth={isMajor ? 1.6 : 1}
                  />
                  {isMajor && i > 0 && x < ruler.length - 16 && (
                    <text
                      x={x}
                      y={28}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={800}
                      fill="#78350F"
                    >
                      {i / 2}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Индикатор угла и подсказка */}
          <div className="absolute bottom-1 left-2 flex items-center gap-1.5 text-[10px] font-extrabold text-amber-900 pointer-events-none">
            <span>📏 {ruler.angle}°</span>
            <span className="opacity-65">· веди ручкой по верхнему краю</span>
          </div>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onCloseRuler();
            }}
            title="Убрать линейку"
            className="absolute bottom-1 right-9 w-5 h-5 rounded-md bg-amber-200/90 hover:bg-rose-500 hover:text-white text-amber-900 text-[10px] font-extrabold flex items-center justify-center"
          >
            ✕
          </button>

          {/* Ручка вращения справа */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              dragRef.current = {
                kind: 'ruler-rotate',
                startX: e.clientX,
                startY: e.clientY,
                origX: ruler.x,
                origY: ruler.y,
                origAngle: ruler.angle,
                startPointerAngle: getPointerAngleFromPivot(
                  e.clientX,
                  e.clientY,
                  ruler.x,
                  ruler.y
                ),
              };
            }}
            title="Потяни, чтобы повернуть линейку"
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-md border-2 border-white flex items-center justify-center text-xs font-extrabold cursor-grab active:cursor-grabbing"
          >
            ↻
          </div>
        </div>
      )}

      {/* 2. ИНТЕРАКТИВНЫЙ ТРАНСПОРТИР */}
      {showProtractor && (
        <div
          style={{
            left: protractor.cx - PROTRACTOR_R,
            top: protractor.cy - PROTRACTOR_R,
            width: PROTRACTOR_R * 2,
            height: PROTRACTOR_R + 24,
            transform: `rotate(${protractor.angle}deg)`,
            transformOrigin: `${PROTRACTOR_R}px ${PROTRACTOR_R}px`,
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            dragRef.current = {
              kind: 'protractor-move',
              startX: e.clientX,
              startY: e.clientY,
              origX: protractor.cx,
              origY: protractor.cy,
              origAngle: protractor.angle,
              startPointerAngle: 0,
            };
          }}
          className="absolute pointer-events-auto cursor-move touch-none"
        >
          <svg
            width={PROTRACTOR_R * 2}
            height={PROTRACTOR_R + 24}
            viewBox={`0 0 ${PROTRACTOR_R * 2} ${PROTRACTOR_R + 24}`}
            className="drop-shadow-lg"
          >
            <path
              d={`M 4 ${PROTRACTOR_R} A ${PROTRACTOR_R - 4} ${PROTRACTOR_R - 4} 0 0 1 ${PROTRACTOR_R * 2 - 4} ${PROTRACTOR_R} L ${PROTRACTOR_R * 2 - 4} ${PROTRACTOR_R + 14} L 4 ${PROTRACTOR_R + 14} Z`}
              fill="rgba(224, 242, 254, 0.78)"
              stroke="#0284C7"
              strokeWidth={2}
            />
            <circle cx={PROTRACTOR_R} cy={PROTRACTOR_R} r={4} fill="#0284C7" />
            <line
              x1={8}
              y1={PROTRACTOR_R}
              x2={PROTRACTOR_R * 2 - 8}
              y2={PROTRACTOR_R}
              stroke="#0284C7"
              strokeWidth={1.2}
              strokeDasharray="4 3"
            />

            {Array.from({ length: 37 }, (_, i) => i * 5).map((deg) => {
              const rad = (-deg * Math.PI) / 180;
              const isMajor = deg % 10 === 0;
              const outer = PROTRACTOR_R - 5;
              const inner = isMajor ? outer - 14 : outer - 8;
              return (
                <g key={deg}>
                  <line
                    x1={PROTRACTOR_R + inner * Math.cos(rad)}
                    y1={PROTRACTOR_R + inner * Math.sin(rad)}
                    x2={PROTRACTOR_R + outer * Math.cos(rad)}
                    y2={PROTRACTOR_R + outer * Math.sin(rad)}
                    stroke="#0369A1"
                    strokeWidth={isMajor ? 1.5 : 0.9}
                  />
                  {deg % 30 === 0 && (
                    <text
                      x={PROTRACTOR_R + (outer - 25) * Math.cos(rad)}
                      y={PROTRACTOR_R + (outer - 25) * Math.sin(rad) + 3.5}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={800}
                      fill="#0C4A6E"
                    >
                      {deg}°
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onCloseProtractor();
            }}
            title="Убрать транспортир"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-sky-600 hover:bg-rose-500 text-white text-[10px] font-extrabold"
          >
            ✕
          </button>

          {/* Ручка вращения */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              dragRef.current = {
                kind: 'protractor-rotate',
                startX: e.clientX,
                startY: e.clientY,
                origX: protractor.cx,
                origY: protractor.cy,
                origAngle: protractor.angle,
                startPointerAngle: getPointerAngleFromPivot(
                  e.clientX,
                  e.clientY,
                  protractor.cx,
                  protractor.cy
                ),
              };
            }}
            title="Повернуть транспортир"
            className="absolute -right-2.5 bottom-3 w-7 h-7 rounded-full bg-sky-600 hover:bg-sky-700 text-white shadow-md border-2 border-white flex items-center justify-center text-xs font-extrabold cursor-grab active:cursor-grabbing"
          >
            ↻
          </div>
        </div>
      )}

      {/* 3. ИНТЕРАКТИВНЫЙ ЦИРКУЛЬ */}
      {showCompass && (
        <div
          style={{
            left: compass.cx - compass.radius - 16,
            top: compass.cy - compass.radius - 16,
            width: (compass.radius + 16) * 2,
            height: (compass.radius + 16) * 2,
          }}
          className="absolute pointer-events-none"
        >
          {/* Пунктирный предпросмотр будущей окружности */}
          <svg
            width={(compass.radius + 16) * 2}
            height={(compass.radius + 16) * 2}
            className="block"
          >
            <circle
              cx={compass.radius + 16}
              cy={compass.radius + 16}
              r={compass.radius}
              fill="rgba(99, 102, 241, 0.06)"
              stroke="#6366F1"
              strokeWidth={1.8}
              strokeDasharray="6 5"
            />
            <line
              x1={compass.radius + 16}
              y1={compass.radius + 16}
              x2={compass.radius + 16 + compass.radius}
              y2={compass.radius + 16}
              stroke="#4F46E5"
              strokeWidth={2}
            />
          </svg>

          {/* Игла-центр (перетаскивание всего циркуля) */}
          <div
            style={{
              left: compass.radius + 16 - 14,
              top: compass.radius + 16 - 14,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              dragRef.current = {
                kind: 'compass-move',
                startX: e.clientX,
                startY: e.clientY,
                origX: compass.cx,
                origY: compass.cy,
                origAngle: 0,
                startPointerAngle: 0,
              };
            }}
            title="Переместить центр (иглу) циркуля"
            className="absolute w-7 h-7 rounded-full bg-indigo-600 text-white border-2 border-white shadow-md flex items-center justify-center text-xs font-extrabold pointer-events-auto cursor-move touch-none"
          >
            ✚
          </div>

          {/* Ручка радиуса справа */}
          <div
            style={{
              left: compass.radius * 2 + 16 - 14,
              top: compass.radius + 16 - 14,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              dragRef.current = {
                kind: 'compass-radius',
                startX: e.clientX,
                startY: e.clientY,
                origX: compass.cx,
                origY: compass.cy,
                origAngle: 0,
                startPointerAngle: 0,
              };
            }}
            title="Потяни, чтобы изменить радиус"
            className="absolute w-7 h-7 rounded-full bg-emerald-600 text-white border-2 border-white shadow-md flex items-center justify-center text-xs font-extrabold pointer-events-auto cursor-ew-resize touch-none"
          >
            ↔
          </div>

          {/* Мини-панель действий циркуля */}
          <div
            style={{
              left: compass.radius + 16,
              top: compass.radius + 16 + 22,
            }}
            className="absolute -translate-x-1/2 pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 text-white shadow-xl border border-slate-700 whitespace-nowrap"
          >
            <span className="text-[11px] font-extrabold text-indigo-300 tabular-nums">
              R = {compassCm} см
            </span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDrawCompassCircle({ x: compass.cx, y: compass.cy }, compass.radius);
              }}
              className="px-2 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-extrabold"
            >
              ✏️ Круг
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onCloseCompass();
              }}
              className="px-1.5 py-0.5 rounded-lg bg-slate-700 hover:bg-rose-500 text-white text-[10px] font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}