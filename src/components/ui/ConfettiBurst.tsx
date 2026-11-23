'use client';

import { useEffect, useRef } from 'react';

interface Props {
  /** Увеличивай число (1, 2, 3...), чтобы запустить новый залп конфетти */
  burstKey: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  life: number;
}

const COLORS = [
  '#6366F1',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#0EA5E9',
  '#8B5CF6',
];

export default function ConfettiBurst({ burstKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (burstKey <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const particles: Particle[] = Array.from({ length: 85 }, () => {
      const fromLeft = Math.random() < 0.5;
      const startX = fromLeft
        ? width * (0.15 + Math.random() * 0.25)
        : width * (0.6 + Math.random() * 0.25);
      const startY = height * (0.25 + Math.random() * 0.2);

      return {
        x: startX,
        y: startY,
        vx: (Math.random() - 0.5) * 11,
        vy: -(5 + Math.random() * 8),
        size: 6 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25,
        life: 1,
      };
    });

    let rafId = 0;
    const startTime = performance.now();

    function frame(now: number) {
      if (!ctx) return;
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, width, height);

      let alive = 0;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28; // гравитация
        p.vx *= 0.99;
        p.rotation += p.vRot;
        p.life = Math.max(0, 1 - elapsed / 2300);

        if (p.life > 0.02 && p.y < height + 30) {
          alive++;
          ctx.save();
          ctx.globalAlpha = p.life;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.65);
          ctx.restore();
        }
      }

      if (alive > 0 && elapsed < 2400) {
        rafId = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [burstKey]);

  if (burstKey <= 0) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-[70] pointer-events-none"
    />
  );
}