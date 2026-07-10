import { RequestStatus, TicketStatus } from '@luxus/types';

export type StatusBadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'success'
  | 'warning';

export function requestStatusBadge(status: RequestStatus): StatusBadgeVariant {
  if (status === RequestStatus.COMPLETED) return 'success';
  if (status === RequestStatus.IN_PROGRESS) return 'warning';
  if (status === RequestStatus.REJECTED) return 'destructive';
  return status === RequestStatus.IN_ANALYSIS ? 'secondary' : 'default';
}

export function ticketStatusBadge(status: TicketStatus): StatusBadgeVariant {
  if (status === TicketStatus.RESOLVED) return 'success';
  if (status === TicketStatus.IN_PROGRESS) return 'warning';
  if (status === TicketStatus.CANCELLED) return 'destructive';
  return status === TicketStatus.PENDING ? 'secondary' : 'default';
}
