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
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_WRITE,
    PERMISSIONS.SALES_READ,
    PERMISSIONS.SALES_WRITE,
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
