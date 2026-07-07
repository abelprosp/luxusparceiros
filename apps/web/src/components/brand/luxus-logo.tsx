'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import logoLight from '@/assets/logos/logo-light.jpg';
import logoDark from '@/assets/logos/logo-dark.jpg';

interface LuxusLogoProps {
  variant?: 'full' | 'icon';
  className?: string;
  /** Forçar versão do logo em fundos escuros (login, sidebar) */
  forceDark?: boolean;
}

export function LuxusLogo({ variant = 'full', className, forceDark = false }: LuxusLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const useDarkLogo = forceDark || (mounted && resolvedTheme === 'dark');
  const logo = useDarkLogo ? logoDark : logoLight;

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
        src={logo.src}
        alt="Luxus Parceiros"
        width={logo.width}
        height={logo.height}
        className={cn('h-11 w-11 rounded-2xl object-contain', className)}
      />
    );
  }

  return (
    <img
      src={logo.src}
      alt="Luxus Parceiros"
      width={logo.width}
      height={logo.height}
      className={cn('h-12 w-auto max-w-[220px] object-contain', className)}
    />
  );
}
