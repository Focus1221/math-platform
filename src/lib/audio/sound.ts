'use client';

export type SoundKind = 'success' | 'error' | 'celebrate' | 'click';

const STORAGE_KEY = 'mathhub_sound';
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx) {
    sharedCtx = new AudioCtx();
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(STORAGE_KEY) !== 'off';
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  window.dispatchEvent(new Event('mathhub-sound-change'));
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
  endFreq?: number
) {
  const now = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playSound(kind: SoundKind): void {
  if (typeof window === 'undefined' || !isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (kind === 'success') {
      // Тёплый звон маримбы вверх (C5 -> E5)
      playTone(ctx, 523.25, 0, 0.14, 0.12, 'triangle');
      playTone(ctx, 659.25, 0.09, 0.22, 0.14, 'triangle');
      navigator.vibrate?.(15);
    } else if (kind === 'celebrate') {
      // Приятный аккорд-перелив (C5 -> E5 -> G5 -> C6)
      playTone(ctx, 523.25, 0, 0.16, 0.11, 'triangle');
      playTone(ctx, 659.25, 0.08, 0.16, 0.12, 'triangle');
      playTone(ctx, 783.99, 0.16, 0.18, 0.12, 'triangle');
      playTone(ctx, 1046.5, 0.24, 0.32, 0.14, 'sine');
      navigator.vibrate?.([20, 40, 25]);
    } else if (kind === 'error') {
      // Мягкий тихий «тук» без резкого негатива
      playTone(ctx, 210, 0, 0.14, 0.08, 'sine', 165);
    } else if (kind === 'click') {
      // Лёгкий щелчок
      playTone(ctx, 580, 0, 0.04, 0.04, 'sine');
    }
  } catch {
    // Игнорируем ограничения автовоспроизведения браузера
  }
}