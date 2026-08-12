'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function onlyDigits(value: string, max?: number) {
  const digits = value.replace(/\D/g, '');
  return typeof max === 'number' ? digits.slice(0, max) : digits;
}

export function formatCpfDigits(digits: string) {
  const d = onlyDigits(digits, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCnpjDigits(digits: string) {
  const d = onlyDigits(digits, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatPhoneDigits(digits: string) {
  const d = onlyDigits(digits, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatCepDigits(digits: string) {
  const d = onlyDigits(digits, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

interface DigitCountdownInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (digits: string) => void;
  /** Quantidade mínima de dígitos para considerar completo. */
  requiredDigits: number;
  /** Máximo de dígitos aceitos (padrão = requiredDigits). */
  maxDigits?: number;
  formatDisplay?: (digits: string) => string;
  hintLabel?: string;
}

export function DigitCountdownInput({
  value,
  onChange,
  requiredDigits,
  maxDigits = requiredDigits,
  formatDisplay,
  hintLabel,
  className,
  ...props
}: DigitCountdownInputProps) {
  const digits = onlyDigits(value, maxDigits);
  const remaining = Math.max(0, requiredDigits - digits.length);
  const display = formatDisplay ? formatDisplay(digits) : digits;
  const complete = remaining === 0;

  return (
    <div className="space-y-1">
      <Input
        {...props}
        inputMode="numeric"
        autoComplete="off"
        className={className}
        value={display}
        onChange={(event) => onChange(onlyDigits(event.target.value, maxDigits))}
      />
      <p
        className={cn(
          'text-xs tabular-nums',
          complete ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
        )}
        aria-live="polite"
      >
        {complete
          ? `Completo${hintLabel ? ` — ${hintLabel}` : ''} (${digits.length}/${requiredDigits}${maxDigits > requiredDigits ? `–${maxDigits}` : ''} dígitos)`
          : `Faltam ${remaining} dígito${remaining === 1 ? '' : 's'}${hintLabel ? ` — ${hintLabel}` : ''} (${digits.length}/${requiredDigits})`}
      </p>
    </div>
  );
}
