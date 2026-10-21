'use client';

import { AlertCircle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

export function ErrorState({
  title = 'Não foi possível carregar',
  message,
  onRetry,
  retrying,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {message || 'Verifique sua conexão e tente novamente.'}
      </p>
      {onRetry && (
        <Button className="mt-5" variant="outline" onClick={onRetry} disabled={retrying}>
          <RotateCw className={cn('mr-2 h-4 w-4', retrying && 'animate-spin')} aria-hidden="true" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function LoadMoreButton({
  hasMore,
  loading,
  onClick,
  shown,
  total,
}: {
  hasMore: boolean;
  loading: boolean;
  onClick: () => void;
  shown: number;
  total: number;
}) {
  if (!shown) return null;
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Exibindo {shown} de {total}
      </p>
      {hasMore && (
        <Button variant="outline" size="sm" onClick={onClick} disabled={loading}>
          {loading ? 'Carregando...' : 'Carregar mais'}
        </Button>
      )}
    </div>
  );
}
