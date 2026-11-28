'use client';

import { useEffect, useRef, useState } from 'react';
import { randInt } from '@/lib/math/utils';

interface Props {
  onResult: (isCorrect: boolean) => void;
}

const TARGET_PRESETS = [25, 35, 45, 60, 75, 90, 110, 125, 135, 150, 165, 180];
const CX = 180;
const CY = 180;
const R = 135;

function getAngleType(deg: number) {
  if (deg === 0) return { name: 'Нулевой угол', color: 'text-slate-600' };
  if (deg < 90) return { name: 'Острый угол (< 90°)', color: 'text-emerald-600' };
  if (deg === 90) return { name: 'Прямой угол (= 90°)', color: 'text-indigo-600' };
  if (deg < 180) return { name: 'Тупой угол (90° < α < 180°)', color: 'text-amber-600' };
  if (deg === 180) return { name: 'Развёрнутый угол (= 180°)', color: 'text-purple-600' };
  if (deg < 360) return { name: 'Больше развёрнутого', color: 'text-sky-600' };
  return { name: 'Полный угол (= 360°)', color: 'text-rose-600' };
}

export default function ProtractorSim({ onResult }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [angle, setAngle] = useState(60);
  const [taskMode, setTaskMode] = useState(false);
  const [targetAngle, setTargetAngle] = useState(120);
  const [dragging, setDragging] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  function clearPendingTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    return () => clearPendingTimer();
  }, []);

  function nextTask() {
    clearPendingTimer();
    setTargetAngle(TARGET_PRESETS[randInt(0, TARGET_PRESETS.length - 1)]);
    setFeedback(null);
  }

  function updateFromPointer(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) * 360) / rect.width - CX;
    const py = ((clientY - rect.top) * 250) / rect.height - CY;
    let deg = Math.round((-Math.atan2(py, px) * 180) / Math.PI);
    if (deg < 0) deg += 360;
    if (taskMode && deg > 180) deg = deg > 270 ? 0 : 180;
    setAngle(deg);
  }

  function checkAngle() {
    clearPendingTimer();
    const ok = Math.abs(angle - targetAngle) <= 3;
    onResult(ok);
    if (ok) {
      setFeedback({
        ok: true,
        text: `✓ Точно в цель! Ты построил ${angle}° (цель ${targetAngle}°).`,
      });
      timerRef.current = setTimeout(nextTask, 1400);
    } else {
      setFeedback({
        ok: false,
        text: `✗ Сейчас угол ${angle}°, а нужно ${targetAngle}°. Подправь луч!`,
      });
    }
  }

  const rad = (-angle * Math.PI) / 180;
  const x2 = CX + R * Math.cos(rad);
  const y2 = CY + R * Math.sin(rad);
  const arcR = 46;
  const ax = CX + arcR * Math.cos(rad);
  const ay = CY + arcR * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;
  const arcPath =
    angle === 360
      ? `M ${CX + arcR} ${CY} A ${arcR} ${arcR} 0 1 0 ${CX + arcR} ${CY + 0.1}`
      : `M ${CX} ${CY} L ${CX + arcR} ${CY} A ${arcR} ${arcR} 0 ${largeArc} 0 ${ax.toFixed(1)} ${ay.toFixed(1)} Z`;

  const info = getAngleType(angle);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => {
              clearPendingTimer();
              setTaskMode(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              !taskMode ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            Свободный транспортир
          </button>
          <button
            type="button"
            onClick={() => {
              setTaskMode(true);
              setAngle(30);
              nextTask();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              taskMode ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            Задание: Построй угол
          </button>
        </div>

        {taskMode && (
          <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 text-xs font-extrabold border border-amber-300">
            🎯 Цель: построй угол {targetAngle}°
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
        <div className="bg-white rounded-2xl p-3 border border-slate-200 flex justify-center">
          <svg
            ref={svgRef}
            viewBox="0 0 360 250"
            className="w-full max-w-[360px] h-auto select-none touch-none cursor-crosshair"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
              updateFromPointer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (dragging) updateFromPointer(e.clientX, e.clientY);
            }}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
          >
            <path
              d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY} Z`}
              fill="rgba(148, 163, 184, 0.12)"
              stroke="rgba(148, 163, 184, 0.45)"
              strokeWidth={2}
            />
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="rgba(148, 163, 184, 0.3)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />

            <g className="text-slate-500">
              {Array.from({ length: 37 }, (_, i) => i * 5).map((d) => {
                const tRad = (-d * Math.PI) / 180;
                const major = d % 10 === 0;
                const inner = major ? R - 14 : R - 8;
                return (
                  <g key={d}>
                    <line
                      x1={CX + inner * Math.cos(tRad)}
                      y1={CY + inner * Math.sin(tRad)}
                      x2={CX + R * Math.cos(tRad)}
                      y2={CY + R * Math.sin(tRad)}
                      stroke="currentColor"
                      strokeWidth={major ? 1.5 : 0.8}
                    />
                    {d % 30 === 0 && (
                      <text
                        x={CX + (R - 27) * Math.cos(tRad)}
                        y={CY + (R - 27) * Math.sin(tRad) + 4}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={700}
                        fill="currentColor"
                      >
                        {d}°
                      </text>
                    )}
                  </g>
                );
              })}
            </g>

            <path
              d={arcPath}
              fill="#6366F1"
              fillOpacity={0.25}
              stroke="#6366F1"
              strokeWidth={1.5}
            />
            <g className="text-slate-800">
              <line
                x1={CX}
                y1={CY}
                x2={CX + R + 10}
                y2={CY}
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
              />
              <circle cx={CX} cy={CY} r={5} fill="currentColor" />
            </g>
            <line
              x1={CX}
              y1={CY}
              x2={x2}
              y2={y2}
              stroke="#6366F1"
              strokeWidth={3.5}
              strokeLinecap="round"
            />
            <circle cx={x2} cy={y2} r={10} fill="#6366F1" stroke="#ffffff" strokeWidth={3} />
          </svg>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
          <div className="text-center">
            <div className="text-xs font-semibold text-slate-400 uppercase">Градусная мера</div>
            <div className="text-4xl font-extrabold text-slate-900 mt-1">
              {taskMode ? '???°' : `${angle}°`}
            </div>
            {!taskMode ? (
              <div className={`text-sm font-bold mt-1 ${info.color}`}>{info.name}</div>
            ) : (
              <div className="text-xs text-slate-500 mt-1">
                Вращай синий луч мышкой/пальцем или ползунком
              </div>
            )}
          </div>

          <div>
            <input
              type="range"
              min={0}
              max={taskMode ? 180 : 360}
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-semibold mt-1">
              <span>0°</span>
              <span>90°</span>
              <span>180°</span>
              {!taskMode && (
                <>
                  <span>270°</span>
                  <span>360°</span>
                </>
              )}
            </div>
          </div>

          {!taskMode ? (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {[30, 45, 90, 120, 180, 270, 360].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAngle(v)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-xs font-bold transition"
                >
                  {v}°
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {feedback && (
                <div
                  className={`text-xs sm:text-sm font-semibold text-center ${
                    feedback.ok ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {feedback.text}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={checkAngle}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold transition"
                >
                  Проверить угол
                </button>
                <button
                  type="button"
                  onClick={nextTask}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                >
                  ↻
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}