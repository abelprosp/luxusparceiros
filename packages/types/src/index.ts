export enum UserRole {
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  PARTNER = 'PARTNER',
  ATTENDANT = 'ATTENDANT',
  FINANCIAL = 'FINANCIAL',
}

export enum PartnerStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
}

export enum BranchStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum LineStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  USED = 'USED',
  BLOCKED = 'BLOCKED',
  ACTIVATED = 'ACTIVATED',
  CANCELLED = 'CANCELLED',
}

export enum SaleStatus {
  IN_ANALYSIS = 'IN_ANALYSIS',
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  ACTIVATED = 'ACTIVATED',
  CANCELLED = 'CANCELLED',
  CONTESTED = 'CONTESTED',
  DOCUMENTS_PENDING = 'DOCUMENTS_PENDING',
}

export enum SaleReviewStatus {
  DRAFT = 'DRAFT',
  AWAITING_REVIEW = 'AWAITING_REVIEW',
  UNDER_REVIEW = 'UNDER_REVIEW',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum SaleTaskSyncStatus {
  NOT_READY = 'NOT_READY',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SYNCED = 'SYNCED',
  RETRY = 'RETRY',
  FAILED = 'FAILED',
}

export enum SaleContractStage {
  PRE_REVIEW = 'PRE_REVIEW',
  TASK_PROCESSING = 'TASK_PROCESSING',
  BLANK_CONTRACT_READY_FOR_ADMIN = 'BLANK_CONTRACT_READY_FOR_ADMIN',
  AWAITING_PARTNER_SIGNATURE = 'AWAITING_PARTNER_SIGNATURE',
  SIGNED_CONTRACT_READY_FOR_ADMIN = 'SIGNED_CONTRACT_READY_FOR_ADMIN',
  TASK_VALIDATING_SIGNED_CONTRACT = 'TASK_VALIDATING_SIGNED_CONTRACT',
  TASK_APPROVED_REVIEW_PENDING = 'TASK_APPROVED_REVIEW_PENDING',
  TASK_REJECTED_REVIEW_PENDING = 'TASK_REJECTED_REVIEW_PENDING',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  COMPLETED = 'COMPLETED',
}

export enum DocumentPurpose {
  GENERAL = 'GENERAL',
  ORIGINAL_SALE = 'ORIGINAL_SALE',
  BLANK_CONTRACT = 'BLANK_CONTRACT',
  SIGNED_CONTRACT = 'SIGNED_CONTRACT',
}

export const SALE_CONTRACT_STAGE_LABELS: Record<SaleContractStage, string> = {
  [SaleContractStage.PRE_REVIEW]: 'Aguardando Luxus Task',
  [SaleContractStage.TASK_PROCESSING]: 'Aguardando Luxus Task',
  [SaleContractStage.BLANK_CONTRACT_READY_FOR_ADMIN]: 'Contrato em branco recebido',
  [SaleContractStage.AWAITING_PARTNER_SIGNATURE]: 'Aguardando assinatura do parceiro',
  [SaleContractStage.SIGNED_CONTRACT_READY_FOR_ADMIN]: 'Contrato assinado pelo parceiro',
  [SaleContractStage.TASK_VALIDATING_SIGNED_CONTRACT]: 'Contrato assinado enviado para conferência no Luxus Task',
  [SaleContractStage.TASK_APPROVED_REVIEW_PENDING]: 'Contrato aprovado no Luxus Task',
  [SaleContractStage.TASK_REJECTED_REVIEW_PENDING]: 'Contrato recusado no Luxus Task',
  [SaleContractStage.CHANGES_REQUESTED]: 'Correção do contrato solicitada',
  [SaleContractStage.COMPLETED]: 'Venda concluída',
};

export type SaleWorkflowTurn = 'luxus_task' | 'luxus_parceiros' | 'parceiro' | 'concluido';

export const SALE_TURN_STAGES: Record<Exclude<SaleWorkflowTurn, 'concluido'>, SaleContractStage[]> = {
  luxus_task: [
    SaleContractStage.PRE_REVIEW,
    SaleContractStage.TASK_PROCESSING,
    SaleContractStage.TASK_VALIDATING_SIGNED_CONTRACT,
  ],
  luxus_parceiros: [
    SaleContractStage.BLANK_CONTRACT_READY_FOR_ADMIN,
    SaleContractStage.SIGNED_CONTRACT_READY_FOR_ADMIN,
    SaleContractStage.TASK_APPROVED_REVIEW_PENDING,
    SaleContractStage.TASK_REJECTED_REVIEW_PENDING,
  ],
  parceiro: [
    SaleContractStage.AWAITING_PARTNER_SIGNATURE,
    SaleContractStage.CHANGES_REQUESTED,
  ],
};

export function saleWorkflowTurn(stage?: SaleContractStage | string | null): SaleWorkflowTurn | null {
  if (!stage) return null;
  if (stage === SaleContractStage.COMPLETED) return 'concluido';
  if ((SALE_TURN_STAGES.luxus_parceiros as string[]).includes(stage)) return 'luxus_parceiros';
  if ((SALE_TURN_STAGES.parceiro as string[]).includes(stage)) return 'parceiro';
  if ((SALE_TURN_STAGES.luxus_task as string[]).includes(stage)) return 'luxus_task';
  return null;
}

export function saleWorkflowTurnLabel(stage?: SaleContractStage | string | null): string | null {
  const turn = saleWorkflowTurn(stage);
  if (turn === 'luxus_task') return 'Luxus Task';
  if (turn === 'luxus_parceiros') return 'Luxus Parceiros';
  if (turn === 'parceiro') return 'Parceiro';
  if (turn === 'concluido') return 'Concluído';
  return null;
}

export enum CommissionType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export enum RequestType {
  NEW_ACTIVATION = 'NEW_ACTIVATION',
  BLOCK = 'BLOCK',
  UNBLOCK = 'UNBLOCK',
  CANCELLATION = 'CANCELLATION',
  DELETION = 'DELETION',
  CHIP_EXCHANGE = 'CHIP_EXCHANGE',
  PLAN_CHANGE = 'PLAN_CHANGE',
  PORTABILITY = 'PORTABILITY',
  SECOND_COPY = 'SECOND_COPY',
  REGISTRATION_CHANGE = 'REGISTRATION_CHANGE',
}

export enum RequestStatus {
  OPEN = 'OPEN',
  IN_ANALYSIS = 'IN_ANALYSIS',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export enum TicketCategory {
  FINANCIAL = 'FINANCIAL',
  SUPPORT = 'SUPPORT',
  OPERATOR = 'OPERATOR',
  SYSTEM = 'SYSTEM',
  REGISTRATION = 'REGISTRATION',
  COMMISSION = 'COMMISSION',
  URGENT = 'URGENT',
}

export enum TicketStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  CANCELLED = 'CANCELLED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum CommissionStatus {
  FORECAST = 'FORECAST',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  PIX = 'PIX',
  TED = 'TED',
}

export enum DocumentType {
  CPF = 'CPF',
  CNPJ = 'CNPJ',
  RG = 'RG',
  SELFIE = 'SELFIE',
  CONTRACT = 'CONTRACT',
  SIGNATURE = 'SIGNATURE',
  LINE_PHOTO = 'LINE_PHOTO',
  CHIP_PHOTO = 'CHIP_PHOTO',
  OTHER = 'OTHER',
}

export enum ContractFormat {
  PRINT = 'PRINT',
  ZAPSIGN = 'ZAPSIGN',
}

export enum DonorOperator {
  VIVO = 'VIVO',
  TIM = 'TIM',
  CLARO = 'CLARO',
  SURF = 'SURF',
  OTHER = 'OTHER',
}

export enum NotificationType {
  COMMISSION = 'COMMISSION',
  LINE_ACTIVATED = 'LINE_ACTIVATED',
  TICKET_REPLY = 'TICKET_REPLY',
  SALE_APPROVED = 'SALE_APPROVED',
  SALE_REJECTED = 'SALE_REJECTED',
  SALE_CONTESTED = 'SALE_CONTESTED',
  DOCUMENTS_REQUESTED = 'DOCUMENTS_REQUESTED',
  CAMPAIGN = 'CAMPAIGN',
  REQUEST = 'REQUEST',
  SYSTEM = 'SYSTEM',
}

export enum StockMovementType {
  ENTRY = 'ENTRY',
  EXIT = 'EXIT',
  TRANSFER = 'TRANSFER',
  RESERVE = 'RESERVE',
  ACTIVATION = 'ACTIVATION',
  WRITE_OFF = 'WRITE_OFF',
}

export enum FinancialType {
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  FINISHED = 'FINISHED',
}

export interface Branch {
  id: string;
  name: string;
  document: string;
  address?: string;
  city?: string;
  state?: string;
  phone: string;
  email: string;
  status: BranchStatus;
  parentPartnerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerPlan {
  id: string;
  partnerId: string;
  planId: string;
  isActive: boolean;
  customCommission?: number;
  plan?: {
    id: string;
    name: string;
    price: number;
    commissionType: CommissionType;
    commissionValue: number;
    operator?: { id: string; name: string };
  };
}

export interface CampaignMetrics {
  totalSales: number;
  totalRevenue: number;
  goalProgress: number;
  salesByPartner: { partnerId: string; partnerName: string; count: number; revenue: number }[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  partnerId?: string;
  partnerName?: string;
  branchId?: string;
  branchName?: string;
  permissions: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface DashboardPartnerMetrics {
  salesToday: number;
  salesMonth: number;
  activeLines: number;
  cancelledLines: number;
  goal: number;
  goalProgress: number;
  forecastCommission: number;
  paidCommission: number;
  ranking: number;
  salesChart: { date: string; value: number }[];
  monthlyChart: { month: string; value: number }[];
  topProducts: { name: string; count: number }[];
  topOperators: { name: string; count: number }[];
}

export interface PartnerMapLocation {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
}

export interface DashboardAdminMetrics {
  totalPartners: number;
  activePartners: number;
  availableLines: number;
  soldLines: number;
  activatedLines: number;
  revenue: number;
  commissions: number;
  salesChart: { date: string; value: number }[];
  partnersInBrazil: PartnerMapLocation[];
  ranking: { partnerId: string; partnerName: string; sales: number }[];
  campaignPerformance?: { campaignId: string; title: string; salesCount: number; revenue: number }[];
}

export interface DashboardDetailRow {
  id: string;
  primary: string;
  secondary?: string;
  status?: string;
  value?: number;
  date?: string;
}

export interface DashboardDetails {
  generatedAt: string;
  scopeLabel: string;
  sales: DashboardDetailRow[];
  partners: DashboardDetailRow[];
  lines: DashboardDetailRow[];
  commissions: DashboardDetailRow[];
  campaigns: DashboardDetailRow[];
}

export interface SaleRequiredDocument {
  type: string;
  label: string;
  fulfilled: boolean;
}

export interface CampaignPerformance {
  campaignId: string;
  title: string;
  salesCount: number;
  revenue: number;
  goal?: number;
  progress?: number;
}

export interface PartnerPlanLink {
  id: string;
  partnerId: string;
  planId: string;
  isActive: boolean;
  customCommission?: number;
  plan?: { id: string; name: string; operator?: { name: string } };
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  partnerId?: string;
  branchId?: string;
  permissions: string[];
}

export const PERMISSIONS = {
  PARTNERS_READ: 'partners:read',
  PARTNERS_WRITE: 'partners:write',
  PARTNERS_DELETE: 'partners:delete',
  CLIENTS_READ: 'clients:read',
  CLIENTS_WRITE: 'clients:write',
  CLIENTS_DELETE: 'clients:delete',
  SALES_READ: 'sales:read',
  SALES_WRITE: 'sales:write',
  SALES_DELETE: 'sales:delete',
  OPERATORS_READ: 'operators:read',
  OPERATORS_WRITE: 'operators:write',
  PLANS_READ: 'plans:read',
  PLANS_WRITE: 'plans:write',
  LINES_READ: 'lines:read',
  LINES_WRITE: 'lines:write',
  STOCK_READ: 'stock:read',
  STOCK_WRITE: 'stock:write',
  COMMISSIONS_READ: 'commissions:read',
  COMMISSIONS_WRITE: 'commissions:write',
  COMMISSIONS_APPROVE: 'commissions:approve',
  TICKETS_READ: 'tickets:read',
  TICKETS_WRITE: 'tickets:write',
  REQUESTS_READ: 'requests:read',
  REQUESTS_WRITE: 'requests:write',
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  FINANCIAL_READ: 'financial:read',
  FINANCIAL_WRITE: 'financial:write',
  CAMPAIGNS_READ: 'campaigns:read',
  CAMPAIGNS_WRITE: 'campaigns:write',
  BRANCHES_READ: 'branches:read',
  BRANCHES_WRITE: 'branches:write',
  BRANCHES_DELETE: 'branches:delete',
  AUDIT_READ: 'audit:read',
  DASHBOARD_READ: 'dashboard:read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: Object.values(PERMISSIONS),
  [UserRole.SUPERVISOR]: [
    PERMISSIONS.PARTNERS_READ,
    PERMISSIONS.BRANCHES_READ,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_WRITE,
    PERMISSIONS.SALES_READ,
    PERMISSIONS.SALES_WRITE,
    PERMISSIONS.OPERATORS_READ,
    PERMISSIONS.PLANS_READ,
    PERMISSIONS.LINES_READ,
    PERMISSIONS.STOCK_READ,
    PERMISSIONS.COMMISSIONS_READ,
    PERMISSIONS.TICKETS_READ,
    PERMISSIONS.TICKETS_WRITE,
    PERMISSIONS.REQUESTS_READ,
    PERMISSIONS.REQUESTS_WRITE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.CAMPAIGNS_READ,
    PERMISSIONS.DASHBOARD_READ,
  ],
  [UserRole.PARTNER]: [
    PERMISSIONS.BRANCHES_READ,
    PERMISSIONS.BRANCHES_WRITE,
    PERMISSIONS.BRANCHES_DELETE,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_WRITE,
    PERMISSIONS.SALES_READ,
    PERMISSIONS.SALES_WRITE,
    PERMISSIONS.OPERATORS_READ,
    PERMISSIONS.PLANS_READ,
    PERMISSIONS.LINES_READ,
    PERMISSIONS.STOCK_READ,
    PERMISSIONS.COMMISSIONS_READ,
    PERMISSIONS.TICKETS_READ,
    PERMISSIONS.TICKETS_WRITE,
    PERMISSIONS.REQUESTS_READ,
    PERMISSIONS.REQUESTS_WRITE,
    PERMISSIONS.DASHBOARD_READ,
  ],
  [UserRole.ATTENDANT]: [
    PERMISSIONS.BRANCHES_READ,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_WRITE,
    PERMISSIONS.SALES_READ,
    PERMISSIONS.SALES_WRITE,
    PERMISSIONS.OPERATORS_READ,
    PERMISSIONS.PLANS_READ,
    PERMISSIONS.LINES_READ,
    PERMISSIONS.STOCK_READ,
    PERMISSIONS.TICKETS_READ,
    PERMISSIONS.TICKETS_WRITE,
    PERMISSIONS.REQUESTS_READ,
    PERMISSIONS.REQUESTS_WRITE,
    PERMISSIONS.DASHBOARD_READ,
  ],
  [UserRole.FINANCIAL]: [
    PERMISSIONS.COMMISSIONS_READ,
    PERMISSIONS.COMMISSIONS_WRITE,
    PERMISSIONS.COMMISSIONS_APPROVE,
    PERMISSIONS.FINANCIAL_READ,
    PERMISSIONS.FINANCIAL_WRITE,
    PERMISSIONS.TICKETS_READ,
    PERMISSIONS.DASHBOARD_READ,
  ],
};

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  [SaleStatus.IN_ANALYSIS]: 'Em análise',
  [SaleStatus.APPROVED]: 'Aprovada',
  [SaleStatus.PENDING]: 'Pendente',
  [SaleStatus.REJECTED]: 'Rejeitada',
  [SaleStatus.ACTIVATED]: 'Ativada',
  [SaleStatus.CANCELLED]: 'Cancelada',
  [SaleStatus.CONTESTED]: 'Contestada',
  [SaleStatus.DOCUMENTS_PENDING]: 'Docs pendentes',
};

export const SALE_REVIEW_STATUS_LABELS: Record<SaleReviewStatus, string> = {
  [SaleReviewStatus.DRAFT]: 'Rascunho',
  [SaleReviewStatus.AWAITING_REVIEW]: 'Aguardando análise',
  [SaleReviewStatus.UNDER_REVIEW]: 'Em análise pelo administrador',
  [SaleReviewStatus.CHANGES_REQUESTED]: 'Correção solicitada',
  [SaleReviewStatus.APPROVED]: 'Aprovada para o Luxus Task',
  [SaleReviewStatus.REJECTED]: 'Rejeitada definitivamente',
  [SaleReviewStatus.CANCELLED]: 'Cancelada',
};

export const LINE_STATUS_LABELS: Record<LineStatus, string> = {
  [LineStatus.AVAILABLE]: 'Disponível',
  [LineStatus.RESERVED]: 'Reservada',
  [LineStatus.USED]: 'Utilizada',
  [LineStatus.BLOCKED]: 'Bloqueada',
  [LineStatus.ACTIVATED]: 'Ativada',
  [LineStatus.CANCELLED]: 'Cancelada',
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  [RequestType.NEW_ACTIVATION]: 'Nova ativação',
  [RequestType.BLOCK]: 'Bloqueio',
  [RequestType.UNBLOCK]: 'Desbloqueio',
  [RequestType.CANCELLATION]: 'Cancelamento',
  [RequestType.DELETION]: 'Exclusão',
  [RequestType.CHIP_EXCHANGE]: 'Troca de chip',
  [RequestType.PLAN_CHANGE]: 'Troca de plano',
  [RequestType.PORTABILITY]: 'Portabilidade',
  [RequestType.SECOND_COPY]: 'Segunda via',
  [RequestType.REGISTRATION_CHANGE]: 'Alteração cadastral',
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  [RequestStatus.OPEN]: 'Aberta',
  [RequestStatus.IN_ANALYSIS]: 'Em análise',
  [RequestStatus.IN_PROGRESS]: 'Em andamento',
  [RequestStatus.COMPLETED]: 'Concluída',
  [RequestStatus.REJECTED]: 'Rejeitada',
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.NEW]: 'Novo',
  [TicketStatus.IN_PROGRESS]: 'Em andamento',
  [TicketStatus.PENDING]: 'Pendente',
  [TicketStatus.RESOLVED]: 'Resolvido',
  [TicketStatus.CANCELLED]: 'Cancelado',
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  [TicketCategory.FINANCIAL]: 'Financeiro',
  [TicketCategory.SUPPORT]: 'Suporte',
  [TicketCategory.OPERATOR]: 'Operadora',
  [TicketCategory.SYSTEM]: 'Sistema',
  [TicketCategory.REGISTRATION]: 'Cadastro',
  [TicketCategory.COMMISSION]: 'Comissão',
  [TicketCategory.URGENT]: 'Urgente',
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'Baixa',
  [TicketPriority.MEDIUM]: 'Média',
  [TicketPriority.HIGH]: 'Alta',
  [TicketPriority.URGENT]: 'Urgente',
};
