'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc';

interface SortState {
  column: number;
  direction: SortDirection;
}

interface TableSortContextValue {
  sort: SortState | null;
  toggleSort: (column: number) => void;
}

const TableSortContext = React.createContext<TableSortContextValue | null>(null);

function textContent(value: React.ReactNode): string {
  if (value == null || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textContent).join(' ');
  if (React.isValidElement<{ children?: React.ReactNode }>(value)) {
    return textContent(value.props.children);
  }
  return '';
}

function comparableValue(value: string): string | number {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const dateMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,]+(\d{2}):(\d{2}))?/);
  if (dateMatch) {
    const [, day, month, year, hour = '0', minute = '0'] = dateMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)).getTime();
  }

  const numeric = normalized
    .replace(/R\$\s*/i, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/%$/, '');
  if (/^-?\d+(?:\.\d+)?$/.test(numeric)) return Number(numeric);
  return normalized.toLocaleLowerCase('pt-BR');
}

function rowCellValue(row: React.ReactNode, column: number): string | number {
  if (!React.isValidElement<{ children?: React.ReactNode }>(row)) return '';
  const cells = React.Children.toArray(row.props.children).filter(React.isValidElement);
  const cell = cells[column];
  if (!React.isValidElement<{ children?: React.ReactNode }>(cell)) return '';
  return comparableValue(textContent(cell.props.children));
}

function Table({ className, children, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  const [sort, setSort] = React.useState<SortState | null>(null);
  const toggleSort = React.useCallback((column: number) => {
    setSort((current) => ({
      column,
      direction: current?.column === column && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  return (
    <div className="relative w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <TableSortContext.Provider value={{ sort, toggleSort }}>
        <table className={cn('w-full min-w-[640px] caption-bottom text-sm', className)} {...props}>
          {children}
        </table>
      </TableSortContext.Provider>
    </div>
  );
}

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(TableSortContext);
  const sortedChildren = React.useMemo(() => {
    if (!context?.sort) return children;
    const { column, direction } = context.sort;
    return React.Children.toArray(children)
      .map((row, index) => ({ row, index, value: rowCellValue(row, column) }))
      .sort((a, b) => {
        let result: number;
        if (typeof a.value === 'number' && typeof b.value === 'number') {
          result = a.value - b.value;
        } else {
          result = String(a.value).localeCompare(String(b.value), 'pt-BR', {
            numeric: true,
            sensitivity: 'base',
          });
        }
        if (result === 0) result = a.index - b.index;
        return direction === 'asc' ? result : -result;
      })
      .map(({ row }) => row);
  }, [children, context?.sort]);

  return (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props}>
      {sortedChildren}
    </tbody>
  );
});
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, children, sortable, onClick, ...props }, ref) => {
    const context = React.useContext(TableSortContext);
    const [columnIndex, setColumnIndex] = React.useState<number | null>(null);
    const label = textContent(children).trim();
    const canSort = sortable ?? Boolean(label && !/^(ações|ação|atribuir)$/i.test(label));
    const active = columnIndex != null && context?.sort?.column === columnIndex;

    return (
      <th
        ref={ref}
        className={cn(
          'h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground',
          canSort && 'cursor-pointer select-none transition-colors hover:text-foreground',
          className,
        )}
        title={canSort ? `Ordenar por ${label}` : props.title}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented && canSort) {
            const index = event.currentTarget.cellIndex;
            setColumnIndex(index);
            context?.toggleSort(index);
          }
        }}
        aria-sort={canSort ? (active ? context?.sort?.direction === 'asc' ? 'ascending' : 'descending' : 'none') : undefined}
        {...props}
      >
        {canSort ? (
          <span className="inline-flex items-center gap-1.5">
            {children}
            {!active ? (
              <ArrowUpDown className="h-3.5 w-3.5 opacity-45" />
            ) : context?.sort?.direction === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5 text-primary" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 text-primary" />
            )}
          </span>
        ) : children}
      </th>
    );
  },
);
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('p-4 align-middle', className)} {...props} />
));
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
