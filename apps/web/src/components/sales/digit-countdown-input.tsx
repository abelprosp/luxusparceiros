'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type CountdownCharset = 'digits' | 'alphanumeric' | 'letters';

export function onlyDigits(value: string, max?: number) {
  const digits = value.replace(/\D/g, '');
  return typeof max === 'number' ? digits.slice(0, max) : digits;
}

export function sanitizeCountdownValue(value: string, charset: CountdownCharset, max?: number) {
  let cleaned = value;
  if (charset === 'digits') cleaned = value.replace(/\D/g, '');
  else if (charset === 'letters') cleaned = value.replace(/[^A-Za-z]/g, '').toUpperCase();
  else cleaned = value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return typeof max === 'number' ? cleaned.slice(0, max) : cleaned;
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

/** Formata RG clássico (ex.: 12.345.678-9). Aceita letra no verificador. */
export function formatRgValue(value: string) {
  const cleaned = sanitizeCountdownValue(value, 'alphanumeric', 11);
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 5) return `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
  if (cleaned.length <= 8) return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5)}`;
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}-${cleaned.slice(8)}`;
  }
  // CIN / formatos longos: sem máscara agressiva
  return cleaned;
}

interface DigitCountdownInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  /** Quantidade mínima para considerar completo. */
  requiredDigits: number;
  /** Máximo aceito (padrão = requiredDigits). */
  maxDigits?: number;
  /** digits (padrão), alphanumeric (RG) ou letters (UF). */
  charset?: CountdownCharset;
  formatDisplay?: (value: string) => string;
  hintLabel?: string;
  unitLabel?: string;
}

export function DigitCountdownInput({
  value,
  onChange,
  requiredDigits,
  maxDigits = requiredDigits,
  charset = 'digits',
  formatDisplay,
  hintLabel,
  unitLabel,
  className,
  inputMode,
  ...props
}: DigitCountdownInputProps) {
  const cleaned = sanitizeCountdownValue(value, charset, maxDigits);
  const remaining = Math.max(0, requiredDigits - cleaned.length);
  const display = formatDisplay ? formatDisplay(cleaned) : cleaned;
  const complete = remaining === 0;
  const unit = unitLabel
    ?? (charset === 'letters' ? 'letra' : charset === 'alphanumeric' ? 'caractere' : 'dígito');
  const unitPlural = unit.endsWith('e') && unit !== 'dígito' ? `${unit}s` : `${unit}s`;
  const resolvedInputMode = inputMode ?? (charset === 'digits' ? 'numeric' : 'text');

  return (
    <div className="space-y-1">
      <Input
        {...props}
        inputMode={resolvedInputMode}
        autoComplete="off"
        className={className}
        value={display}
        onChange={(event) => onChange(sanitizeCountdownValue(event.target.value, charset, maxDigits))}
      />
      <p
        className={cn(
          'text-xs tabular-nums',
          complete ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
        )}
        aria-live="polite"
      >
        {complete
          ? `Completo${hintLabel ? ` — ${hintLabel}` : ''} (${cleaned.length}/${requiredDigits}${maxDigits > requiredDigits ? `–${maxDigits}` : ''} ${unitPlural})`
          : `Faltam ${remaining} ${remaining === 1 ? unit : unitPlural}${hintLabel ? ` — ${hintLabel}` : ''} (${cleaned.length}/${requiredDigits})`}
      </p>
    </div>
  );
}
