import { SaleStatus, RequestStatus, TicketStatus, TicketPriority, CommissionStatus, LineStatus } from '@luxus/types';

export const SALE_STATUS_LABELS: Record<string, string> = {
  [SaleStatus.IN_ANALYSIS]: 'Em análise',
  [SaleStatus.APPROVED]: 'Aprovada',
  [SaleStatus.PENDING]: 'Pendente',
  [SaleStatus.REJECTED]: 'Rejeitada',
  [SaleStatus.ACTIVATED]: 'Ativada',
  [SaleStatus.CANCELLED]: 'Cancelada',
  [SaleStatus.CONTESTED]: 'Contestada',
  [SaleStatus.DOCUMENTS_PENDING]: 'Docs pendentes',
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  [RequestStatus.OPEN]: 'Aberta',
  [RequestStatus.IN_ANALYSIS]: 'Em análise',
  [RequestStatus.IN_PROGRESS]: 'Em andamento',
  [RequestStatus.COMPLETED]: 'Concluída',
  [RequestStatus.REJECTED]: 'Rejeitada',
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  [TicketStatus.NEW]: 'Novo',
  [TicketStatus.IN_PROGRESS]: 'Em andamento',
  [TicketStatus.PENDING]: 'Pendente',
  [TicketStatus.RESOLVED]: 'Resolvido',
  [TicketStatus.CANCELLED]: 'Cancelado',
};

export const COMMISSION_STATUS_LABELS: Record<string, string> = {
  [CommissionStatus.FORECAST]: 'Previsão',
  [CommissionStatus.APPROVED]: 'Aprovada',
  [CommissionStatus.PAID]: 'Pagamento confirmado',
  [CommissionStatus.CANCELLED]: 'Cancelada',
};

export const LINE_STATUS_LABELS: Record<string, string> = {
  [LineStatus.AVAILABLE]: 'Disponível',
  [LineStatus.RESERVED]: 'Reservada',
  [LineStatus.USED]: 'Utilizada',
  [LineStatus.BLOCKED]: 'Bloqueada',
  [LineStatus.ACTIVATED]: 'Ativada',
  [LineStatus.CANCELLED]: 'Cancelada',
};

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  NEW_ACTIVATION: 'Nova ativação',
  BLOCK: 'Bloqueio',
  UNBLOCK: 'Desbloqueio',
  CANCELLATION: 'Cancelamento',
  DELETION: 'Exclusão',
  CHIP_EXCHANGE: 'Troca de chip',
  PLAN_CHANGE: 'Troca de plano',
  PORTABILITY: 'Portabilidade',
  SECOND_COPY: 'Segunda via',
  REGISTRATION_CHANGE: 'Alteração cadastral',
};

export const TICKET_CATEGORY_LABELS: Record<string, string> = {
  FINANCIAL: 'Financeiro',
  SUPPORT: 'Suporte',
  OPERATOR: 'Operadora',
  SYSTEM: 'Sistema',
  REGISTRATION: 'Cadastro',
  COMMISSION: 'Comissão',
  URGENT: 'Urgente',
};

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  [TicketPriority.LOW]: 'Baixa',
  [TicketPriority.MEDIUM]: 'Média',
  [TicketPriority.HIGH]: 'Alta',
  [TicketPriority.URGENT]: 'Urgente',
};

export function getStatusLabel(status: string, map: Record<string, string>): string {
  return map[status] ?? status;
}
