import {
  REQUEST_STATUS_LABELS,
  TICKET_STATUS_LABELS,
  type RequestStatus,
  type TicketStatus,
} from '@luxus/types';
import { formatDateTime } from '@luxus/utils';
import { Clock3 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ActivityEntry {
  id: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  details?: string | null;
  createdAt: string;
}

interface ActivityLogProps {
  entries?: ActivityEntry[];
}

const STATUS_LABELS: Record<string, string> = {
  ...REQUEST_STATUS_LABELS,
  ...TICKET_STATUS_LABELS,
};

const statusLabel = (status?: string | null) =>
  status
    ? STATUS_LABELS[status as RequestStatus | TicketStatus] ?? status
    : undefined;

export function ActivityLog({ entries = [] }: ActivityLogProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Clock3 className="h-4 w-4 text-muted-foreground" />
        Log de atividades
      </div>
      <ScrollArea className="h-40 rounded-lg border p-3">
        {entries.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhuma atividade registrada.
          </p>
        ) : (
          <div className="space-y-4">
            {[...entries].reverse().map((entry) => {
              const from = statusLabel(entry.fromStatus);
              const to = statusLabel(entry.toStatus);
              return (
                <div key={entry.id} className="relative border-l-2 border-border pl-3 text-sm">
                  <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" />
                  <p className="font-medium">{entry.action}</p>
                  {to && (
                    <p className="text-xs text-muted-foreground">
                      {from ? `${from} → ${to}` : to}
                    </p>
                  )}
                  {entry.details && (
                    <p className="mt-1 text-xs text-muted-foreground">{entry.details}</p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
