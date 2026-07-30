'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import logoForDarkBg from '@/assets/logos/logo-light.png';
import logoForLightBg from '@/assets/logos/logo-dark.png';

interface LuxusLogoProps {
  variant?: 'full' | 'icon';
  className?: string;
  /** Forçar versão para fundos escuros (login, sidebar) */
  forceDark?: boolean;
}

export function LuxusLogo({ variant = 'full', className, forceDark = false }: LuxusLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const useDarkBackgroundLogo = forceDark || (mounted && resolvedTheme === 'dark');
  const logo = useDarkBackgroundLogo ? logoForDarkBg : logoForLightBg;

  if (!mounted) {
    return (
      <div
        className={cn(
          variant === 'icon' ? 'h-10 w-10' : 'h-10 w-[140px]',
          'animate-pulse rounded-xl bg-muted',
          className,
        )}
      />
    );
  }

  if (variant === 'icon') {
    return (
      <span
        className={cn(
          'relative block h-12 w-12 shrink-0 overflow-hidden',
          className,
        )}
      >
        <Image
          src={logo}
          alt="Luxus Parceiros"
          width={logo.width}
          height={logo.height}
          className="absolute left-0 top-1/2 h-full w-auto max-w-none -translate-y-1/2 object-contain"
        />
      </span>
    );
  }

  return (
    <Image
      src={logo}
      alt="Luxus Parceiros"
      width={logo.width}
      height={logo.height}
      className={cn('h-10 w-auto max-w-[220px] object-contain', className)}
    />
  );
}
