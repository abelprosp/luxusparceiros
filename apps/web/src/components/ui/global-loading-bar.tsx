'use client';

import { useEffect, useRef, useState } from 'react';
import { API_ACTIVITY_EVENT } from '@/lib/api';

const SHOW_DELAY_MS = 350;
const MINIMUM_VISIBLE_MS = 300;

export function GlobalLoadingBar() {
  const [visible, setVisible] = useState(false);
  const visibleSince = useRef(0);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleActivity = (event: Event) => {
      const pending = (event as CustomEvent<{ pending: number }>).detail?.pending ?? 0;
      if (showTimer.current) clearTimeout(showTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);

      if (pending > 0) {
        showTimer.current = setTimeout(() => {
          visibleSince.current = Date.now();
          setVisible(true);
        }, SHOW_DELAY_MS);
        return;
      }

      const remaining = Math.max(0, MINIMUM_VISIBLE_MS - (Date.now() - visibleSince.current));
      hideTimer.current = setTimeout(() => setVisible(false), remaining);
    };

    window.addEventListener(API_ACTIVITY_EVENT, handleActivity);
    return () => {
      window.removeEventListener(API_ACTIVITY_EVENT, handleActivity);
      if (showTimer.current) clearTimeout(showTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-primary/15 transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="progressbar"
      aria-label="Carregando informações"
      aria-hidden={!visible}
    >
      <div className="global-loading-indicator h-full w-1/3 rounded-r-full bg-primary shadow-[0_0_10px_rgba(0,87,255,0.75)]" />
    </div>
  );
}
