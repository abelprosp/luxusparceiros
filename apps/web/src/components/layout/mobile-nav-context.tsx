'use client';

import { createContext, useCallback, useContext, useState } from 'react';

interface MobileNavContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((current) => !current), []);

  return (
    <MobileNavContext.Provider value={{ open, setOpen, toggle }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  const context = useContext(MobileNavContext);
  if (!context) {
    throw new Error('useMobileNav must be used within MobileNavProvider');
  }
  return context;
}
