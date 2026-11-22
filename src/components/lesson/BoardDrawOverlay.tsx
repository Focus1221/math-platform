'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Stroke {
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

interface Props {
  onExitBoard: () => void;
}

const COLORS = [
  { value: '#E11D48', label: 'Красный' },
  { value: '#4F46E5', label: 'Синий' },
  { value: '#059669', label: 'Зелёный' },
  { value: '#0F172A', label: 'Чёрный' },
  { value: '#D97706', label: 'Оранжевый' },
];

const WIDTHS = [
  { value: 3, label: 'Тонкий' },
  { value: 6, label: 'Средний' },
  { value: 11, label: 'Толстый' },
];

export default function BoardDrawOverlay({ onExitBoard }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeStrokeRef = useRef<Stroke | null>(null);

  const [drawEnabled, setDrawEnabled] = useState(false);
  const [color, setColor] = useState(COLORS[0].value);
  const [width, setWidth] = useState(4);
  const [strokeCount, setStrokeCount] = useState(0);

  const drawSingleStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      if (stroke.points.length === 0) return;
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    },
    []
  );

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const stroke of strokesRef.current) {
      drawSingleStroke(ctx, stroke);
    }
  }, [drawSingleStroke]);

  useEffect(() => {
    function handleResize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      redrawAll();
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redrawAll]);

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawEnabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const point = { x: e.clientX, y: e.clientY };
    const newStroke: Stroke = { color, width, points: [point] };
    activeStrokeRef.current = newStroke;

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSingleStroke(ctx, newStroke);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawEnabled || !activeStrokeRef.current) return;
    const stroke = activeStrokeRef.current;
    const prev = stroke.points[stroke.points.length - 1];
    const next = { x: e.clientX, y: e.clientY };
    stroke.points.push(next);

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && prev) {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
    }
  }

  function finishStroke() {
    if (!activeStrokeRef.current) return;
    strokesRef.current.push(activeStrokeRef.current);
    activeStrokeRef.current = null;
    setStrokeCount(strokesRef.current.length);
  }

  function handleUndo() {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redrawAll();
  }

  function handleClear() {
    strokesRef.current = [];
    activeStrokeRef.current = null;
    setStrokeCount(0);
    redrawAll();
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        className={`fixed inset-0 z-50 touch-none ${
          drawEnabled ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'
        }`}
      />

      {/* Плавающая панель доски внизу экрана */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] max-w-[96vw] bg-slate-900/95 text-white backdrop-blur rounded-2xl shadow-2xl border border-slate-700 px-3 py-2 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setDrawEnabled((v) => !v)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            drawEnabled
              ? 'bg-amber-400 text-slate-950 shadow-xs'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
          }`}
        >
          {drawEnabled ? '✏️ Маркер включён' : '🖱️ Прокрутка / клики'}
        </button>

        <div className="h-5 w-px bg-slate-700 hidden sm:block" />

        <div className="flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => {
                setColor(c.value);
                setDrawEnabled(true);
              }}
              className={`w-6 h-6 rounded-full border-2 transition ${
                color === c.value && drawEnabled
                  ? 'border-white scale-115'
                  : 'border-slate-600 hover:scale-105'
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
          {WIDTHS.map((w) => (
            <button
              key={w.value}
              type="button"
              title={w.label}
              onClick={() => {
                setWidth(w.value);
                setDrawEnabled(true);
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                width === w.value
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {w.value === 3 ? 'S' : w.value === 6 ? 'M' : 'L'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={strokeCount === 0}
            onClick={handleUndo}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold transition"
            title="Отменить последний штрих"
          >
            ↩
          </button>
          <button
            type="button"
            disabled={strokeCount === 0}
            onClick={handleClear}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 disabled:opacity-40 text-xs font-bold transition"
            title="Очистить доску"
          >
            🗑️ Очистить
          </button>
        </div>

        <div className="h-5 w-px bg-slate-700 hidden sm:block" />

        <button
          type="button"
          onClick={onExitBoard}
          className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition"
        >
          ✕ Выйти с доски
        </button>
      </div>
    </>
  );
}