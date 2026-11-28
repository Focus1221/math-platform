export interface Point {
  x: number;
  y: number;
}

export type BoardViewMode = 'glass' | 'split' | 'full';
export type BoardBg = 'grid' | 'coords' | 'chalk' | 'plain';
export type BoardTool =
  | 'cursor'
  | 'pen'
  | 'highlighter'
  | 'laser'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'eraser';

export type BoardElement =
  | {
      id: string;
      kind: 'pen' | 'highlighter';
      color: string;
      width: number;
      points: Point[];
    }
  | {
      id: string;
      kind: 'line' | 'arrow' | 'rect' | 'circle';
      color: string;
      width: number;
      start: Point;
      end: Point;
    };

export interface BoardPage {
  id: string;
  bg: BoardBg;
  elements: BoardElement[];
  undoStack: BoardElement[][];
  redoStack: BoardElement[][];
}

export const GRID_STEP = 28;

export const BOARD_COLORS = [
  { value: '#0F172A', label: 'Чёрный' },
  { value: '#FFFFFF', label: 'Белый мел' },
  { value: '#2563EB', label: 'Синий' },
  { value: '#E11D48', label: 'Красный' },
  { value: '#059669', label: 'Зелёный' },
  { value: '#D97706', label: 'Оранжевый' },
  { value: '#FACC15', label: 'Жёлтый мел' },
];

export const BOARD_WIDTHS = [
  { value: 3, label: 'S' },
  { value: 6, label: 'M' },
  { value: 11, label: 'L' },
];

export function snapPoint(p: Point, enabled: boolean): Point {
  if (!enabled) return p;
  return {
    x: Math.round(p.x / GRID_STEP) * GRID_STEP,
    y: Math.round(p.y / GRID_STEP) * GRID_STEP,
  };
}

export function createEmptyPage(bg: BoardBg = 'grid'): BoardPage {
  return {
    id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    bg,
    elements: [],
    undoStack: [],
    redoStack: [],
  };
}

export function drawBoardBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bg: BoardBg
): void {
  if (bg === 'plain') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (bg === 'chalk') {
    ctx.fillStyle = '#0E2F25';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = GRID_STEP; x < width; x += GRID_STEP) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    for (let y = GRID_STEP; y < height; y += GRID_STEP) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
    ctx.stroke();
    return;
  }

  // Белая бумага для 'grid' и 'coords'
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = bg === 'coords' ? '#E2E8F0' : '#DBEAFE';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = GRID_STEP; x < width; x += GRID_STEP) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
  }
  for (let y = GRID_STEP; y < height; y += GRID_STEP) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
  }
  ctx.stroke();

  if (bg === 'coords') {
    const ox = Math.round(width / 2 / GRID_STEP) * GRID_STEP;
    const oy = Math.round(height / 2 / GRID_STEP) * GRID_STEP;

    ctx.strokeStyle = '#334155';
    ctx.fillStyle = '#334155';
    ctx.lineWidth = 2;

    // Ось X
    ctx.beginPath();
    ctx.moveTo(12, oy);
    ctx.lineTo(width - 14, oy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width - 8, oy);
    ctx.lineTo(width - 20, oy - 6);
    ctx.lineTo(width - 20, oy + 6);
    ctx.closePath();
    ctx.fill();

    // Ось Y
    ctx.beginPath();
    ctx.moveTo(ox, height - 12);
    ctx.lineTo(ox, 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox, 8);
    ctx.lineTo(ox - 6, 20);
    ctx.lineTo(ox + 6, 20);
    ctx.closePath();
    ctx.fill();

    // Штрихи и подписи осей
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const maxUnitsX = Math.floor(Math.max(ox, width - ox) / GRID_STEP);
    for (let u = -maxUnitsX; u <= maxUnitsX; u++) {
      if (u === 0) continue;
      const x = ox + u * GRID_STEP;
      if (x < 24 || x > width - 28) continue;
      ctx.beginPath();
      ctx.moveTo(x, oy - 4);
      ctx.lineTo(x, oy + 4);
      ctx.stroke();
      if (u % 2 === 0 || Math.abs(u) === 1) {
        ctx.fillText(String(u), x, oy + 7);
      }
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const maxUnitsY = Math.floor(Math.max(oy, height - oy) / GRID_STEP);
    for (let u = -maxUnitsY; u <= maxUnitsY; u++) {
      if (u === 0) continue;
      const y = oy - u * GRID_STEP;
      if (y < 28 || y > height - 24) continue;
      ctx.beginPath();
      ctx.moveTo(ox - 4, y);
      ctx.lineTo(ox + 4, y);
      ctx.stroke();
      if (u % 2 === 0 || Math.abs(u) === 1) {
        ctx.fillText(String(u), ox - 8, y);
      }
    }

    // Ноль и названия осей
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('0', ox - 7, oy + 6);
    ctx.fillText('x', width - 14, oy + 10);
    ctx.textAlign = 'left';
    ctx.fillText('y', ox + 10, 12);
  }
}

export function drawBoardElement(
  ctx: CanvasRenderingContext2D,
  el: BoardElement
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if ('points' in el) {
    const pts = el.points;
    if (pts.length === 0) {
      ctx.restore();
      return;
    }

    const isHighlighter = el.kind === 'highlighter';
    ctx.strokeStyle = el.color;
    ctx.fillStyle = el.color;
    ctx.lineWidth = isHighlighter ? el.width * 3.2 : el.width;
    ctx.globalAlpha = isHighlighter ? 0.34 : 1;

    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.color;
  ctx.lineWidth = el.width;

  const { start, end } = el;

  if (el.kind === 'line') {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  } else if (el.kind === 'arrow') {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const headLen = Math.max(12, el.width * 3.2);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    if (Math.hypot(dx, dy) > 4) {
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLen * Math.cos(angle - Math.PI / 6),
        end.y - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        end.x - headLen * Math.cos(angle + Math.PI / 6),
        end.y - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    }
  } else if (el.kind === 'rect') {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    ctx.strokeRect(x, y, w, h);
  } else if (el.kind === 'circle') {
    const r = Math.hypot(end.x - start.x, end.y - start.y);
    ctx.beginPath();
    ctx.arc(start.x, start.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Точка центра окружности — удобно для задач по геометрии
    if (r > 14) {
      ctx.beginPath();
      ctx.arc(start.x, start.y, Math.max(2.5, el.width * 0.65), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

export function hitTestElement(
  el: BoardElement,
  p: Point,
  baseRadius = 14
): boolean {
  const threshold = Math.max(baseRadius, el.width * 1.6);

  if ('points' in el) {
    const pts = el.points;
    if (pts.length === 0) return false;
    if (pts.length === 1) {
      return Math.hypot(p.x - pts[0].x, p.y - pts[0].y) <= threshold;
    }
    const r = el.kind === 'highlighter' ? Math.max(threshold, el.width * 2.2) : threshold;
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSegment(p, pts[i], pts[i + 1]) <= r) return true;
    }
    return false;
  }

  const { start, end } = el;
  if (el.kind === 'line' || el.kind === 'arrow') {
    return distToSegment(p, start, end) <= threshold;
  }

  if (el.kind === 'rect') {
    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const y2 = Math.max(start.y, end.y);
    const tl = { x: x1, y: y1 };
    const tr = { x: x2, y: y1 };
    const br = { x: x2, y: y2 };
    const bl = { x: x1, y: y2 };
    return (
      distToSegment(p, tl, tr) <= threshold ||
      distToSegment(p, tr, br) <= threshold ||
      distToSegment(p, br, bl) <= threshold ||
      distToSegment(p, bl, tl) <= threshold
    );
  }

  if (el.kind === 'circle') {
    const r = Math.hypot(end.x - start.x, end.y - start.y);
    const d = Math.hypot(p.x - start.x, p.y - start.y);
    return Math.abs(d - r) <= threshold || d <= Math.min(12, threshold);
  }

  return false;
}