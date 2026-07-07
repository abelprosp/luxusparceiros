'use client';

import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
  variant?: 'default' | 'accent';
}

const SPARKLINE_HEIGHTS = [38, 62, 45, 78, 55, 88, 64, 72];

function MiniSparkline({ accent }: { accent?: boolean }) {
  return (
    <div className="flex h-12 items-end gap-1.5">
      {SPARKLINE_HEIGHTS.map((height, index) => (
        <div
          key={index}
          className={cn(
            'w-2 rounded-full',
            accent ? 'bg-white/25' : 'bg-primary/20',
          )}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

export function MetricsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  variant = 'default',
}: MetricsCardProps) {
  const isAccent = variant === 'accent';

  return (
    <div
      className={cn(
        isAccent ? 'bento-card-dark' : 'bento-card',
        'p-5 sm:p-6',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className={cn('text-sm font-medium', isAccent ? 'text-white/60' : 'text-muted-foreground')}>
            {title}
          </p>
          <p className={cn('text-2xl font-bold tracking-tight sm:text-3xl', isAccent && 'text-white')}>
            {value}
          </p>
          {description && (
            <p className={cn('text-xs', isAccent ? 'text-white/50' : 'text-muted-foreground')}>
              {description}
            </p>
          )}
          {trend && (
            <p
              className={cn(
                'text-xs font-medium',
                trend.value >= 0
                  ? isAccent ? 'text-emerald-300' : 'text-emerald-600'
                  : isAccent ? 'text-rose-300' : 'text-rose-500',
              )}
            >
              {trend.value >= 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
            isAccent ? 'bg-white/10' : 'bg-primary/10',
          )}
        >
          <Icon className={cn('h-5 w-5', isAccent ? 'text-white' : 'text-primary')} />
        </div>
      </div>
      <div className="mt-5">
        <MiniSparkline accent={isAccent} />
      </div>
    </div>
  );
}
