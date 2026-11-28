'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { playSound } from '@/lib/audio/sound';
import {
  BOARD_COLORS,
  BOARD_WIDTHS,
  createEmptyPage,
  drawBoardBackground,
  drawBoardElement,
  hitTestElement,
  snapPoint,
  type BoardBg,
  type BoardElement,
  type BoardPage,
  type BoardTool,
  type BoardViewMode,
  type Point,
} from './board/boardTypes';
import BoardGeoTools, {
  snapPointToRulerEdge,
  type RulerState,
} from './board/BoardGeoTools';
import type { Material, Topic } from '@/types/db';

interface LaserSample {
  x: number;
  y: number;
  t: number;
}

interface Props {
  onExitBoard: () => void;
  topic?: Topic | null;
  isTeacher?: boolean;
  onMaterialSaved?: (material: Material) => void;
  onLayoutChange?: (mode: BoardViewMode) => void;
}

const VIEW_MODES: { id: BoardViewMode; icon: string; label: string }[] = [
  { id: 'glass', icon: '🪟', label: 'Поверх' },
  { id: 'split', icon: '◧', label: 'Сплит' },
  { id: 'full', icon: '🟩', label: 'Доска' },
];

const BG_OPTIONS: { id: BoardBg; icon: string; label: string }[] = [
  { id: 'grid', icon: '▦', label: 'Клетка' },
  { id: 'coords', icon: '╋', label: 'Оси XY' },
  { id: 'chalk', icon: '🟩', label: 'Мел' },
  { id: 'plain', icon: '⬜', label: 'Лист' },
];

const TOOLS: { id: BoardTool; icon: string; label: string; glassOnly?: boolean }[] = [
  { id: 'cursor', icon: '🖱️', label: 'Клики / прокрутка', glassOnly: true },
  { id: 'pen', icon: '✏️', label: 'Ручка / мел' },
  { id: 'highlighter', icon: '🖍️', label: 'Выделитель' },
  { id: 'laser', icon: '🔴', label: 'Лазерная указка' },
  { id: 'line', icon: '╱', label: 'Отрезок' },
  { id: 'arrow', icon: '↗', label: 'Луч / стрелка' },
  { id: 'rect', icon: '▭', label: 'Прямоугольник' },
  { id: 'circle', icon: '◯', label: 'Окружность' },
  { id: 'eraser', icon: '🧽', label: 'Ластик (удаляет элемент)' },
];

export default function BoardDrawOverlay({
  onExitBoard,
  topic = null,
  isTeacher = false,
  onMaterialSaved,
  onLayoutChange,
}: Props) {
  const supabase = createClient();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [viewMode, setViewMode] = useState<BoardViewMode>('glass');
  const [pages, setPages] = useState<BoardPage[]>(() => [createEmptyPage('grid')]);
  const [pageIdx, setPageIdx] = useState(0);

  const [tool, setTool] = useState<BoardTool>('pen');
  const [color, setColor] = useState<string>('#E11D48');
  const [width, setWidth] = useState<number>(4);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [shadeOpen, setShadeOpen] = useState<boolean>(false);
  const [shadeTopPct, setShadeTopPct] = useState<number>(52);
  const [toolbarMinimized, setToolbarMinimized] = useState<boolean>(false);

  // Чертёжные инструменты
  const [showRuler, setShowRuler] = useState<boolean>(false);
  const [showProtractor, setShowProtractor] = useState<boolean>(false);
  const [showCompass, setShowCompass] = useState<boolean>(false);
  const [ruler, setRuler] = useState<RulerState>({
    x: 120,
    y: 180,
    angle: 0,
    length: 392, // ровно 14 см по сетке 28px
  });

  const [savingToLesson, setSavingToLesson] = useState<boolean>(false);
  const [toast, setToast] = useState<string>('');

  const activeDraftRef = useRef<BoardElement | null>(null);
  const eraseSnapshotRef = useRef<BoardElement[] | null>(null);
  const erasedDuringDragRef = useRef<boolean>(false);
  const laserTrailRef = useRef<LaserSample[]>([]);
  const laserRafRef = useRef<number | null>(null);
  const pointerDownRef = useRef<boolean>(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const safePageIdx = Math.min(pageIdx, Math.max(0, pages.length - 1));
  const currentPage = pages[safePageIdx];
  const pagesRef = useRef(pages);
  const safePageIdxRef = useRef(safePageIdx);

  useEffect(() => {
    pagesRef.current = pages;
    safePageIdxRef.current = safePageIdx;
  }, [pages, safePageIdx]);

  useEffect(() => {
    onLayoutChange?.(viewMode);
  }, [viewMode, onLayoutChange]);

  useEffect(() => {
    return () => {
      onLayoutChange?.('glass');
      if (laserRafRef.current) cancelAnimationFrame(laserRafRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [onLayoutChange]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 3200);
  }, []);

  const redrawMain = useCallback(() => {
    const canvas = mainCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.max(1, Math.floor(rect.width * dpr));
    const targetH = Math.max(1, Math.floor(rect.height * dpr));

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const page = pagesRef.current[safePageIdxRef.current];
    if (!page) return;

    if (viewMode !== 'glass') {
      drawBoardBackground(ctx, rect.width, rect.height, page.bg);
    }

    for (const el of page.elements) {
      drawBoardElement(ctx, el);
    }
  }, [viewMode]);

  const redrawLive = useCallback(() => {
    const canvas = liveCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.max(1, Math.floor(rect.width * dpr));
    const targetH = Math.max(1, Math.floor(rect.height * dpr));

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // 1. Предпросмотр рисуемой прямо сейчас фигуры или штриха
    if (activeDraftRef.current) {
      drawBoardElement(ctx, activeDraftRef.current);
    }

    // 2. Исчезающий след лазерной указки
    const now = performance.now();
    const lifetimeMs = 1100;
    laserTrailRef.current = laserTrailRef.current.filter(
      (sample) => now - sample.t < lifetimeMs
    );
    const trail = laserTrailRef.current;

    if (trail.length > 0) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 1; i < trail.length; i++) {
        const prev = trail[i - 1];
        const curr = trail[i];
        const alpha = Math.max(0, 1 - (now - curr.t) / lifetimeMs);
        ctx.strokeStyle = `rgba(244, 63, 94, ${alpha * 0.9})`;
        ctx.lineWidth = 3 + alpha * 6;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
      }

      const head = trail[trail.length - 1];
      const headAlpha = Math.max(0, 1 - (now - head.t) / lifetimeMs);
      ctx.fillStyle = `rgba(244, 63, 94, ${headAlpha * 0.35})`;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 255, 255, ${headAlpha})`;
      ctx.strokeStyle = `rgba(225, 29, 72, ${headAlpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  const ensureLaserLoop = useCallback(() => {
    if (laserRafRef.current !== null) return;
    const step = () => {
      redrawLive();
      if (laserTrailRef.current.length > 0) {
        laserRafRef.current = requestAnimationFrame(step);
      } else {
        laserRafRef.current = null;
      }
    };
    laserRafRef.current = requestAnimationFrame(step);
  }, [redrawLive]);

  // Перерисовываем при изменении страниц, фона или размера контейнера
  useEffect(() => {
    redrawMain();
    redrawLive();
  }, [pages, safePageIdx, viewMode, redrawMain, redrawLive]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      redrawMain();
      redrawLive();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [redrawMain, redrawLive]);

  function switchViewMode(nextMode: BoardViewMode) {
    playSound('click');
    setViewMode(nextMode);
    if (nextMode !== 'glass' && tool === 'cursor') {
      setTool('pen');
    }
  }

  function setPageBg(nextBg: BoardBg) {
    playSound('click');
    if (nextBg === 'chalk' && color === '#0F172A') {
      setColor('#FFFFFF');
    } else if (nextBg !== 'chalk' && color === '#FFFFFF') {
      setColor('#0F172A');
    }

    setPages((prev) =>
      prev.map((p, idx) => (idx === safePageIdx ? { ...p, bg: nextBg } : p))
    );
  }

  function addNewPage() {
    playSound('click');
    const nextPage = createEmptyPage(currentPage?.bg || 'grid');
    setPages((prev) => [...prev, nextPage]);
    setPageIdx(pages.length);
  }

  function deleteCurrentPage() {
    if (pages.length <= 1) return;
    playSound('click');
    setPages((prev) => prev.filter((_, idx) => idx !== safePageIdx));
    setPageIdx(Math.max(0, safePageIdx - 1));
  }

  const updateCurrentPageElements = useCallback(
    (updater: (elements: BoardElement[]) => BoardElement[], pushUndo = true) => {
      setPages((prev) =>
        prev.map((page, idx) => {
          if (idx !== safePageIdxRef.current) return page;
          const nextElements = updater(page.elements);
          if (!pushUndo) {
            return { ...page, elements: nextElements };
          }
          return {
            ...page,
            elements: nextElements,
            undoStack: [...page.undoStack.slice(-39), page.elements],
            redoStack: [],
          };
        })
      );
    },
    []
  );

  const handleUndo = useCallback(() => {
    playSound('click');
    setPages((prev) =>
      prev.map((page, idx) => {
        if (idx !== safePageIdxRef.current || page.undoStack.length === 0) return page;
        const previous = page.undoStack[page.undoStack.length - 1];
        return {
          ...page,
          elements: previous,
          undoStack: page.undoStack.slice(0, -1),
          redoStack: [...page.redoStack, page.elements],
        };
      })
    );
  }, []);

  const handleRedo = useCallback(() => {
    playSound('click');
    setPages((prev) =>
      prev.map((page, idx) => {
        if (idx !== safePageIdxRef.current || page.redoStack.length === 0) return page;
        const next = page.redoStack[page.redoStack.length - 1];
        return {
          ...page,
          elements: next,
          undoStack: [...page.undoStack, page.elements],
          redoStack: page.redoStack.slice(0, -1),
        };
      })
    );
  }, []);

  function handleClearPage() {
    if (!currentPage || currentPage.elements.length === 0) return;
    playSound('click');
    updateCurrentPageElements(() => [], true);
  }

  function handleDrawCompassCircle(center: Point, radius: number) {
    playSound('success');
    updateCurrentPageElements(
      (els) => [
        ...els,
        {
          id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'circle',
          color,
          width,
          start: center,
          end: { x: center.x + radius, y: center.y },
        },
      ],
      true
    );
  }

  // Горячие клавиши Ctrl+Z / Ctrl+Y
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  function getRelativePoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  const shouldSnapShapes =
    snapToGrid &&
    viewMode !== 'glass' &&
    (currentPage?.bg === 'grid' || currentPage?.bg === 'coords');

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (viewMode === 'glass' && tool === 'cursor') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerDownRef.current = true;

    const basePt = getRelativePoint(e);
    const rulerSnap =
      showRuler && (tool === 'pen' || tool === 'highlighter' || tool === 'line')
        ? snapPointToRulerEdge(basePt, ruler)
        : { snapped: basePt, onEdge: false };
    const rawPt = rulerSnap.snapped;

    if (tool === 'laser') {
      laserTrailRef.current.push({ x: basePt.x, y: basePt.y, t: performance.now() });
      ensureLaserLoop();
      return;
    }

    if (tool === 'eraser') {
      const cur = pagesRef.current[safePageIdxRef.current];
      eraseSnapshotRef.current = cur ? cur.elements : [];
      erasedDuringDragRef.current = false;
      eraseAtPoint(basePt);
      return;
    }

    if (tool === 'pen' || tool === 'highlighter') {
      activeDraftRef.current = {
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: tool,
        color,
        width,
        points: [rawPt],
      };
      redrawLive();
      return;
    }

    if (
      tool === 'line' ||
      tool === 'arrow' ||
      tool === 'rect' ||
      tool === 'circle'
    ) {
      const finalPt = rulerSnap.onEdge
        ? rawPt
        : snapPoint(rawPt, shouldSnapShapes);
      activeDraftRef.current = {
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: tool,
        color,
        width,
        start: finalPt,
        end: finalPt,
      };
      redrawLive();
    }
  }

  function eraseAtPoint(pt: Point) {
    const cur = pagesRef.current[safePageIdxRef.current];
    if (!cur || cur.elements.length === 0) return;

    const remaining = cur.elements.filter((el) => !hitTestElement(el, pt, 16));
    if (remaining.length !== cur.elements.length) {
      erasedDuringDragRef.current = true;
      updateCurrentPageElements(() => remaining, false);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!pointerDownRef.current) return;
    const basePt = getRelativePoint(e);
    const rulerSnap =
      showRuler && (tool === 'pen' || tool === 'highlighter' || tool === 'line')
        ? snapPointToRulerEdge(basePt, ruler)
        : { snapped: basePt, onEdge: false };
    const rawPt = rulerSnap.snapped;

    if (tool === 'laser') {
      laserTrailRef.current.push({ x: basePt.x, y: basePt.y, t: performance.now() });
      ensureLaserLoop();
      return;
    }

    if (tool === 'eraser') {
      eraseAtPoint(basePt);
      return;
    }

    const draft = activeDraftRef.current;
    if (!draft) return;

    if ('points' in draft) {
      const last = draft.points[draft.points.length - 1];
      if (!last || Math.hypot(rawPt.x - last.x, rawPt.y - last.y) >= 2) {
        draft.points.push(rawPt);
        redrawLive();
      }
      return;
    }

    draft.end = rulerSnap.onEdge ? rawPt : snapPoint(rawPt, shouldSnapShapes);
    redrawLive();
  }

  function finishPointer() {
    if (!pointerDownRef.current) return;
    pointerDownRef.current = false;

    if (tool === 'eraser') {
      if (erasedDuringDragRef.current && eraseSnapshotRef.current) {
        const snapshotBeforeErase = eraseSnapshotRef.current;
        setPages((prev) =>
          prev.map((page, idx) => {
            if (idx !== safePageIdxRef.current) return page;
            return {
              ...page,
              undoStack: [...page.undoStack.slice(-39), snapshotBeforeErase],
              redoStack: [],
            };
          })
        );
      }
      eraseSnapshotRef.current = null;
      erasedDuringDragRef.current = false;
      return;
    }

    const draft = activeDraftRef.current;
    if (!draft) return;
    activeDraftRef.current = null;
    redrawLive();

    // Игнорируем случайный нулевой клик для фигур
    if (
      'start' in draft &&
      Math.hypot(draft.end.x - draft.start.x, draft.end.y - draft.start.y) < 3
    ) {
      return;
    }

    updateCurrentPageElements((els) => [...els, draft], true);
  }

  // Экспорт текущего листа доски в PNG Blob
  async function renderCurrentPageBlob(): Promise<Blob | null> {
    const container = containerRef.current;
    const page = pagesRef.current[safePageIdxRef.current];
    if (!container || !page) return null;

    const rect = container.getBoundingClientRect();
    const scale = 2;
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.max(2, Math.floor(rect.width * scale));
    offscreen.height = Math.max(2, Math.floor(rect.height * scale));
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    ctx.scale(scale, scale);
    drawBoardBackground(
      ctx,
      rect.width,
      rect.height,
      viewMode === 'glass' ? 'plain' : page.bg
    );
    for (const el of page.elements) {
      drawBoardElement(ctx, el);
    }

    return new Promise((resolve) => {
      offscreen.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  async function handleDownloadPng() {
    playSound('click');
    const blob = await renderCurrentPageBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mathhub-board-p${safePageIdx + 1}.png`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('⬇ Лист скачан в PNG');
  }

  async function handleSaveToLesson() {
    if (!isTeacher || !topic) return;
    setSavingToLesson(true);
    try {
      const blob = await renderCurrentPageBlob();
      if (!blob) {
        showToast('Не удалось сформировать изображение доски');
        return;
      }

      const path = `${topic.id}/board_${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from('lesson-materials')
        .upload(path, blob, { contentType: 'image/png' });

      if (upErr) {
        alert('Ошибка загрузки листа доски: ' + upErr.message);
        return;
      }

      const { data: pub } = supabase.storage
        .from('lesson-materials')
        .getPublicUrl(path);

      const dateLabel = new Date().toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
      });

      const { data: created, error: dbErr } = await supabase
        .from('materials')
        .insert({
          topic_id: topic.id,
          kind: 'presentation',
          title: `Доска урока · Лист ${safePageIdx + 1} (${dateLabel})`,
          description: `Записи учителя с доски по теме «${topic.title}»`,
          url: pub.publicUrl,
          storage_path: path,
          file_name: `board-page-${safePageIdx + 1}.png`,
        })
        .select()
        .single();

      if (dbErr || !created) {
        alert('Ошибка сохранения в материалы урока: ' + dbErr?.message);
        return;
      }

      playSound('celebrate');
      onMaterialSaved?.(created as Material);
      showToast('✓ Лист сохранён в «Материалы к уроку»!');
    } finally {
      setSavingToLesson(false);
    }
  }

  // Перетаскивание шторки-занавеса
  function handleShadePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleShadePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pct = ((e.clientY - rect.top) / rect.height) * 100;
    setShadeTopPct(Math.max(8, Math.min(92, pct)));
  }

  const isInteractiveCanvas = viewMode !== 'glass' || tool !== 'cursor';
  const containerClass =
    viewMode === 'glass'
      ? 'fixed top-16 inset-x-0 bottom-0 z-40'
      : viewMode === 'split'
        ? 'fixed top-16 right-0 bottom-0 w-full md:w-1/2 z-40 border-l-2 border-slate-300 shadow-2xl'
        : 'fixed top-16 inset-x-0 bottom-0 z-40';

  const canUndo = (currentPage?.undoStack.length ?? 0) > 0;
  const canRedo = (currentPage?.redoStack.length ?? 0) > 0;
  const hasElements = (currentPage?.elements.length ?? 0) > 0;

  return (
    <>
      {/* Рабочая область холста (ниже шапки h-16, чтобы не перекрывать навигацию) */}
      <div
        ref={containerRef}
        className={`${containerClass} ${
          isInteractiveCanvas ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <canvas
          ref={mainCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        <canvas
          ref={liveCanvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          className={`absolute inset-0 w-full h-full touch-none ${
            isInteractiveCanvas
              ? tool === 'eraser'
                ? 'cursor-cell'
                : tool === 'laser'
                  ? 'cursor-pointer'
                  : 'cursor-crosshair'
              : 'pointer-events-none'
          }`}
        />

        {/* Чертёжные инструменты: линейка, транспортир, циркуль */}
        <BoardGeoTools
          showRuler={showRuler}
          showProtractor={showProtractor}
          showCompass={showCompass}
          ruler={ruler}
          onRulerChange={setRuler}
          onCloseRuler={() => setShowRuler(false)}
          onCloseProtractor={() => setShowProtractor(false)}
          onCloseCompass={() => setShowCompass(false)}
          onDrawCompassCircle={handleDrawCompassCircle}
        />

        {/* Листы и фоны доски */}
        {viewMode !== 'glass' && (
          <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 pointer-events-auto">
            <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900/85 text-white backdrop-blur text-[11px] font-bold shadow-md">
              {pages.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    playSound('click');
                    setPageIdx(idx);
                  }}
                  className={`px-2 py-1 rounded-lg transition ${
                    idx === safePageIdx
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Лист {idx + 1}
                </button>
              ))}
              {pages.length < 10 && (
                <button
                  type="button"
                  onClick={addNewPage}
                  title="Добавить чистый лист"
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600 text-emerald-300 hover:text-white font-extrabold transition"
                >
                  +
                </button>
              )}
              {pages.length > 1 && (
                <button
                  type="button"
                  onClick={deleteCurrentPage}
                  title="Удалить текущий лист"
                  className="px-1.5 py-1 rounded-lg hover:bg-rose-600 text-slate-400 hover:text-white transition"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/85 text-white backdrop-blur text-[11px] font-bold shadow-md">
              {BG_OPTIONS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setPageBg(b.id)}
                  title={b.label}
                  className={`px-2 py-1 rounded-lg transition ${
                    currentPage?.bg === b.id
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="mr-1">{b.icon}</span>
                  <span className="hidden sm:inline">{b.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {toast && (
          <div className="absolute top-3 right-3 z-30 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold shadow-lg animate-pop">
            {toast}
          </div>
        )}

        {/* Шторка-занавес */}
        {shadeOpen && (
          <div
            style={{ top: `${shadeTopPct}%` }}
            className="absolute inset-x-0 bottom-0 z-20 bg-slate-900/95 backdrop-blur-md border-t-4 border-amber-400 shadow-2xl pointer-events-auto flex flex-col"
          >
            <div
              onPointerDown={handleShadePointerDown}
              onPointerMove={handleShadePointerMove}
              className="h-10 cursor-ns-resize touch-none flex items-center justify-between px-4 bg-slate-800/90 text-amber-300 text-xs font-extrabold select-none"
            >
              <span>🪟 Шторка (потяни вверх или вниз, чтобы открыть шаг)</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playSound('click');
                  setShadeOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-rose-600 text-white text-[11px]"
              >
                Убрать ✕
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs font-bold select-none pointer-events-none">
              Скрытая область экрана
            </div>
          </div>
        )}
      </div>

      {/* Плавающий пульт MathBoard внизу экрана */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] max-w-[97vw] print:hidden">
        {toolbarMinimized ? (
          <div className="bg-slate-900/95 text-white backdrop-blur rounded-2xl shadow-2xl border border-slate-700 px-3 py-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setToolbarMinimized(false)}
              className="px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-xs font-extrabold"
            >
              🎨 Развернуть пульт доски
            </button>
            <button
              type="button"
              onClick={onExitBoard}
              className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-xs font-extrabold"
            >
              ✕ Выйти
            </button>
          </div>
        ) : (
          <div className="bg-slate-900/95 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700 px-2.5 py-2 space-y-2">
            {/* Верхний ряд: Режим экрана + Инструменты рисования */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <div className="flex items-center gap-0.5 bg-slate-800 p-0.5 rounded-xl">
                {VIEW_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => switchViewMode(m.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition ${
                      viewMode === m.id
                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {m.icon} <span className="hidden sm:inline">{m.label}</span>
                  </button>
                ))}
              </div>

              <div className="h-5 w-px bg-slate-700 hidden sm:block" />

              <div className="flex flex-wrap items-center justify-center gap-1">
                {TOOLS.filter((t) => !t.glassOnly || viewMode === 'glass').map((t) => {
                  const active = tool === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      title={t.label}
                      onClick={() => {
                        playSound('click');
                        setTool(t.id);
                      }}
                      className={`h-8 min-w-[34px] px-2 rounded-xl text-xs font-extrabold transition flex items-center justify-center ${
                        active
                          ? 'bg-amber-400 text-slate-950 shadow-xs scale-105'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {t.icon}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Нижний ряд: Цвета, толщина, сетка, шторка, чертёжные инструменты, история, сохранение */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1 border-t border-slate-800">
              <div className="flex items-center gap-1">
                {BOARD_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => {
                      setColor(c.value);
                      if (tool === 'cursor' || tool === 'eraser' || tool === 'laser') {
                        setTool('pen');
                      }
                    }}
                    className={`w-6 h-6 rounded-full border-2 transition ${
                      color === c.value
                        ? 'border-amber-400 scale-115'
                        : 'border-slate-500 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-0.5 bg-slate-800 p-0.5 rounded-xl">
                {BOARD_WIDTHS.map((w) => (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => setWidth(w.value)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition ${
                      width === w.value
                        ? 'bg-indigo-500 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>

              {viewMode !== 'glass' && (
                <button
                  type="button"
                  title="Прилипание фигур к узлам сетки"
                  onClick={() => {
                    playSound('click');
                    setSnapToGrid((v) => !v);
                  }}
                  className={`px-2 py-1 rounded-xl text-[11px] font-bold transition ${
                    snapToGrid
                      ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/50'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  🧲 Сетка
                </button>
              )}

              <button
                type="button"
                title="Шторка для постепенного открытия решения"
                onClick={() => {
                  playSound('click');
                  setShadeOpen((v) => !v);
                }}
                className={`px-2 py-1 rounded-xl text-[11px] font-bold transition ${
                  shadeOpen
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                🪟 Шторка
              </button>

              {/* Геометрические инструменты */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Линейка (рисуй ровно вдоль верхнего края)"
                  onClick={() => {
                    playSound('click');
                    setShowRuler((v) => !v);
                  }}
                  className={`px-2 py-1 rounded-xl text-[11px] font-bold transition ${
                    showRuler
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  📏
                </button>
                <button
                  type="button"
                  title="Транспортир"
                  onClick={() => {
                    playSound('click');
                    setShowProtractor((v) => !v);
                  }}
                  className={`px-2 py-1 rounded-xl text-[11px] font-bold transition ${
                    showProtractor
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  📐
                </button>
                <button
                  type="button"
                  title="Циркуль"
                  onClick={() => {
                    playSound('click');
                    setShowCompass((v) => !v);
                  }}
                  className={`px-2 py-1 rounded-xl text-[11px] font-bold transition ${
                    showCompass
                      ? 'bg-indigo-400 text-slate-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  🧭
                </button>
              </div>

              <div className="h-5 w-px bg-slate-700 hidden sm:block" />

              {/* Undo / Redo / Clear */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={handleUndo}
                  title="Отменить (Ctrl+Z)"
                  className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-xs font-bold"
                >
                  ↩
                </button>
                <button
                  type="button"
                  disabled={!canRedo}
                  onClick={handleRedo}
                  title="Вернуть (Ctrl+Y)"
                  className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-xs font-bold"
                >
                  ↪
                </button>
                <button
                  type="button"
                  disabled={!hasElements}
                  onClick={handleClearPage}
                  title="Очистить лист"
                  className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-rose-600 disabled:opacity-35 text-xs font-bold"
                >
                  🗑️
                </button>
              </div>

              {/* Сохранение */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  title="Скачать лист доски как PNG"
                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
                >
                  ⬇ PNG
                </button>

                {isTeacher && topic && (
                  <button
                    type="button"
                    disabled={savingToLesson}
                    onClick={handleSaveToLesson}
                    title="Сохранить этот лист в материалы урока для учеников"
                    className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold transition"
                  >
                    {savingToLesson ? '...' : '💾 В урок'}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setToolbarMinimized(true)}
                title="Свернуть пульт"
                className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold"
              >
                ⌄
              </button>

              <button
                type="button"
                onClick={onExitBoard}
                className="px-2.5 py-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-extrabold"
              >
                ✕ Выйти
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}