'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

interface LuxusLogoProps {
  variant?: 'full' | 'icon';
  className?: string;
  /** Forçar versão do logo em fundos escuros (login, sidebar) */
  forceDark?: boolean;
}

const LOGO_SOURCES = {
  light: '/logo-luxus-parceiros-light.png',
  dark: '/logo-luxus-parceiros-dark.png',
} as const;

export function LuxusLogo({ variant = 'full', className, forceDark = false }: LuxusLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const useDarkLogo = forceDark || (mounted && resolvedTheme === 'dark');
  const src = useDarkLogo ? LOGO_SOURCES.dark : LOGO_SOURCES.light;

  if (!mounted) {
    return (
      <div
        className={cn(
          variant === 'icon' ? 'h-11 w-11' : 'h-12 w-[180px]',
          'animate-pulse rounded-2xl bg-muted',
          className,
        )}
      />
    );
  }

  if (variant === 'icon') {
    return (
      <img
        src={src}
        alt="Luxus Parceiros"
        className={cn('h-11 w-11 rounded-2xl object-contain', className)}
      />
    );
  }

  return (
    <img
      src={src}
      alt="Luxus Parceiros"
      className={cn('h-12 w-auto max-w-[220px] object-contain', className)}
    />
  );
}
