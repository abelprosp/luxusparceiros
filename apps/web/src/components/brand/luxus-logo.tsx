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

  return (
    <Image
      src={logo}
      alt="Luxus Parceiros"
      width={logo.width}
      height={logo.height}
      className={cn(
        'object-contain',
        variant === 'icon' ? 'h-10 w-10' : 'h-10 w-auto max-w-[200px]',
        className,
      )}
    />
  );
}
