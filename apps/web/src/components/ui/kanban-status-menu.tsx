'use client';

import { ArrowRightLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface KanbanStatusMenuProps<S extends string> {
  current: S;
  options: { status: S; label: string }[];
  itemLabel: string;
  disabled?: boolean;
  onChange: (status: S) => void;
}

/** Alternativa ao arrastar-e-soltar: permite mudar a coluna pelo teclado ou leitor de tela. */
export function KanbanStatusMenu<S extends string>({
  current,
  options,
  itemLabel,
  disabled,
  onChange,
}: KanbanStatusMenuProps<S>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={disabled}
          aria-label={`Alterar status de ${itemLabel}`}
          title="Alterar status"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuLabel>Alterar status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem
            key={option.status}
            disabled={option.status === current}
            onSelect={() => onChange(option.status)}
          >
            <Check className={option.status === current ? 'mr-2 h-4 w-4' : 'mr-2 h-4 w-4 opacity-0'} aria-hidden="true" />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
