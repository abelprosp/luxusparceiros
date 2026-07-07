'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

interface LuxusLogoProps {
  variant?: 'full' | 'icon';
  className?: string;
}

const LOGO_SOURCES = {
  light: '/logo-luxus-parceiros-light.png',
  dark: '/logo-luxus-parceiros-dark.png',
} as const;

export function LuxusLogo({ variant = 'full', className }: LuxusLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const src = mounted && resolvedTheme === 'dark' ? LOGO_SOURCES.dark : LOGO_SOURCES.light;

  if (variant === 'icon') {
    return (
      <Image
        src={src}
        alt="Luxus Parceiros"
        width={44}
        height={44}
        className={cn('h-11 w-11 rounded-2xl object-cover object-left', className)}
        priority
      />
    );
  }

  return (
    <Image
      src={src}
      alt="Luxus Parceiros"
      width={240}
      height={64}
      className={cn('h-12 w-auto max-w-[220px] object-contain', className)}
      priority
    />
  );
}
