'use client';

import { useEffect, useState } from 'react';
import { playSound } from '@/lib/audio/sound';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'mathhub_pwa_dismissed';

export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // Игнорируем ограничения приватного режима
    }

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    function handleInstalled() {
      setVisible(false);
      setDeferredPrompt(null);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    playSound('click');
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      playSound('celebrate');
    }
    setDeferredPrompt(null);
    setVisible(false);
  }

  function handleDismiss() {
    playSound('click');
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Игнорируем ограничения приватного режима
    }
  }

  if (!visible || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-5 left-4 z-40 print:hidden animate-pop">
      <div className="bg-white/95 backdrop-blur-md border-2 border-indigo-300 shadow-xl rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleInstallClick}
          className="inline-flex items-center gap-2 text-xs font-extrabold text-indigo-700 hover:text-indigo-900 transition"
        >
          <span className="text-base leading-none">📲</span>
          <span>Установить MathHub</span>
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          title="Скрыть"
          className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-[11px] font-bold"
        >
          ✕
        </button>
      </div>
    </div>
  );
}