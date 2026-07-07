import { cn } from '@/lib/utils';

interface MobileListCardProps {
  title: string;
  subtitle?: string;
  meta?: string;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function MobileListCard({
  title,
  subtitle,
  meta,
  badges,
  actions,
  onClick,
  className,
}: MobileListCardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        'rounded-xl border bg-card p-4 shadow-card',
        onClick && 'cursor-pointer active:bg-muted/40',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-tight">{title}</p>
          {subtitle ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
          {badges ? <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div> : null}
          {meta ? <p className="mt-2 text-xs text-muted-foreground">{meta}</p> : null}
        </div>
        {actions ? (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface ResponsiveDataViewProps {
  table: React.ReactNode;
  mobile: React.ReactNode;
}

export function ResponsiveDataView({ table, mobile }: ResponsiveDataViewProps) {
  return (
    <>
      <div className="hidden md:block rounded-xl border bg-card shadow-card">{table}</div>
      <div className="space-y-3 md:hidden">{mobile}</div>
    </>
  );
}
