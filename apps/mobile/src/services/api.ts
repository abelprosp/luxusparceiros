import type {
  AuthTokens,
  AuthUser,
  LoginRequest,
  ApiResponse,
  PaginatedResponse,
  DashboardPartnerMetrics,
} from '@luxus/types';

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const API_URL = `${API_BASE}/api`;
export const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? `${API_BASE}/events`;

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
};

type TokenRefreshCallback = () => Promise<AuthTokens | null>;

let accessToken: string | null = null;
let refreshCallback: TokenRefreshCallback | null = null;
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setRefreshCallback(callback: TokenRefreshCallback) {
  refreshCallback = callback;
}

async function processRefreshQueue(token: string | null) {
  refreshQueue.forEach((resolve) => resolve(token));
  refreshQueue = [];
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshCallback) return null;

  if (isRefreshing) {
    return new Promise((resolve) => {
      refreshQueue.push(resolve);
    });
  }

  isRefreshing = true;
  try {
    const tokens = await refreshCallback();
    const token = tokens?.accessToken ?? null;
    accessToken = token;
    await processRefreshQueue(token);
    return token;
  } catch {
    await processRefreshQueue(null);
    return null;
  } finally {
    isRefreshing = false;
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, skipAuth = false } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (!skipAuth && accessToken) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !skipAuth && refreshCallback) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      requestHeaders.Authorization = `Bearer ${newToken}`;
      const retryResponse = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!retryResponse.ok) {
        const error = await retryResponse.json().catch(() => ({}));
        throw new ApiError(retryResponse.status, error.message ?? error.error ?? 'Erro na requisição');
      }
      return retryResponse.json();
    }
    throw new ApiError(401, 'Sessão expirada');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.message ?? error.error ?? 'Erro na requisição');
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'POST', body }),
  put: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'PUT', body }),
  patch: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'PATCH', body }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<ApiResponse<{ user: AuthUser; tokens: AuthTokens }>>('/auth/login', data),
  refresh: (refreshToken: string) =>
    api.post<ApiResponse<AuthTokens>>('/auth/refresh', { refreshToken }),
  logout: () => api.post<ApiResponse>('/auth/logout'),
  me: () => api.get<ApiResponse<AuthUser>>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<ApiResponse>('/auth/change-password', { currentPassword, newPassword }),
  forgotPassword: (email: string) =>
    api.post<ApiResponse>('/auth/forgot-password', { email }),
};

export const dashboardApi = {
  partner: () => api.get<ApiResponse<DashboardPartnerMetrics>>('/dashboard/partner'),
};

export interface Client {
  id: string;
  name: string;
  document: string;
  documentType: string;
  rg?: string;
  email?: string;
  phone: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  isActive: boolean;
  createdAt: string;
  lines?: Line[];
  documents?: DocumentItem[];
}

export interface Line {
  id: string;
  number: string;
  status: string;
  operator?: { id: string; name: string };
  plan?: { id: string; name: string };
  activatedAt?: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  type: string;
  url: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  protocol: string;
  status: string;
  value: number;
  commissionValue: number;
  isPortability: boolean;
  newNumber?: string;
  chipIccid?: string;
  contractFormat?: string;
  rejectionReason?: string;
  contestReason?: string;
  requiredDocuments?: { type: string; label: string; fulfilled: boolean }[];
  createdAt: string;
  client?: { id: string; name: string };
  operator?: { id: string; name: string };
  plan?: { id: string; name: string };
  line?: { id: string; number: string };
  campaign?: { id: string; title: string };
}

export interface Operator {
  id: string;
  name: string;
  slug: string;
  logo?: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  commission: number;
  commissionType?: 'PERCENTAGE' | 'FIXED';
  commissionValue?: number;
  customCommission?: number;
  operatorId: string;
}

export interface SimCard {
  id: string;
  iccid: string;
  status: string;
  operator?: { id: string; name: string };
}

export interface BranchItem {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  status: string;
  parentPartnerId: string;
  createdAt: string;
  _count?: { sales: number; clients: number };
}

export interface RequestItem {
  id: string;
  protocol: string;
  type: string;
  status: string;
  description: string;
  createdAt: string;
  resolution?: string;
  client?: { id: string; name: string };
  partner?: { id: string; name: string };
  comments?: RequestComment[];
}

export interface RequestComment {
  id: string;
  content: string;
  createdAt: string;
  isInternal?: boolean;
  user?: { id: string; name: string };
}

export interface Ticket {
  id: string;
  protocol: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  messages?: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticketId?: string;
  content: string;
  createdAt: string;
  user?: { id: string; name: string };
  isInternal: boolean;
}

export interface Commission {
  id: string;
  value: number;
  percentage: number;
  status: string;
  createdAt: string;
  paidAt?: string;
  sale?: { protocol: string; client?: { name: string } };
}

export interface PartnerProfile {
  id: string;
  name: string;
  tradeName?: string;
  document: string;
  email: string;
  phone: string;
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  pixKey?: string;
  pixKeyType?: string;
}

export interface UserProfile extends AuthUser {
  phone?: string;
  avatar?: string;
  biometricEnabled?: boolean;
  theme?: string;
  notificationsEnabled?: boolean;
}

export const clientsApi = {
  list: (params?: { search?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return api.get<ApiResponse<PaginatedResponse<Client>>>(`/clients${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api.get<ApiResponse<Client>>(`/clients/${id}`),
  create: (data: Partial<Client>) => api.post<ApiResponse<Client>>('/clients', data),
  update: (id: string, data: Partial<Client>) => api.put<ApiResponse<Client>>(`/clients/${id}`, data),
};

export const salesApi = {
  list: (params?: { status?: string; page?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    const qs = query.toString();
    return api.get<ApiResponse<PaginatedResponse<Sale>>>(`/sales${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api.get<ApiResponse<Sale>>(`/sales/${id}`),
  create: (data: Record<string, unknown>) => api.post<ApiResponse<Sale>>('/sales', data),
};

export const uploadsApi = {
  upload: async (params: {
    uri: string;
    name: string;
    mimeType?: string;
    type: string;
    saleId?: string;
    clientId?: string;
  }) => {
    const token = getAccessToken();
    const formData = new FormData();
    formData.append('file', {
      uri: params.uri,
      name: params.name,
      type: params.mimeType ?? 'image/jpeg',
    } as unknown as Blob);
    formData.append('type', params.type);
    if (params.saleId) formData.append('saleId', params.saleId);
    if (params.clientId) formData.append('clientId', params.clientId);

    const response = await fetch(`${API_URL}/uploads`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message ?? error.error ?? 'Falha no upload');
    }
    return response.json();
  },
};

export const operatorsApi = {
  list: () => api.get<ApiResponse<Operator[]>>('/operators'),
};

export const plansApi = {
  list: async (operatorId?: string) => {
    const qs = operatorId ? `?operatorId=${operatorId}` : '';
    const res = await api.get<ApiResponse<PaginatedResponse<Plan>>>(`/plans/available${qs}`);
    if (res.success && res.data) {
      return { success: true, data: res.data.data } as ApiResponse<Plan[]>;
    }
    return { success: false, data: [] } as ApiResponse<Plan[]>;
  },
};

export const stockApi = {
  lines: (params?: { status?: string }) => {
    const qs = params?.status ? `?status=${params.status}` : '';
    return api.get<ApiResponse<PaginatedResponse<Line>>>(`/stock/lines${qs}`);
  },
  simCards: () => api.get<ApiResponse<PaginatedResponse<SimCard>>>('/stock/sim-cards'),
  reserve: (lineId: string) => api.post<ApiResponse<Line>>(`/stock/lines/${lineId}/reserve`),
};

export const branchesApi = {
  list: (params?: { page?: number; partnerId?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.partnerId) query.set('partnerId', params.partnerId);
    const qs = query.toString();
    return api.get<ApiResponse<PaginatedResponse<BranchItem>>>(`/branches${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api.get<ApiResponse<BranchItem>>(`/branches/${id}`),
  create: (data: Partial<BranchItem>) =>
    api.post<ApiResponse<BranchItem>>('/branches', data),
  createForPartner: (partnerId: string, data: Partial<BranchItem>) =>
    api.post<ApiResponse<BranchItem>>(`/branches/partner/${partnerId}`, data),
  update: (id: string, data: Partial<BranchItem>) =>
    api.patch<ApiResponse<BranchItem>>(`/branches/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<{ message: string }>>(`/branches/${id}`),
};

export const requestsApi = {
  list: (params?: { status?: string; page?: number; branchId?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.branchId) query.set('branchId', params.branchId);
    const qs = query.toString();
    return api.get<ApiResponse<PaginatedResponse<RequestItem>>>(`/requests${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api.get<ApiResponse<RequestItem>>(`/requests/${id}`),
  create: (data: Record<string, unknown>) => api.post<ApiResponse<RequestItem>>('/requests', data),
  addComment: (id: string, content: string) =>
    api.post<ApiResponse<RequestComment>>(`/requests/${id}/comments`, { content }),
  updateStatus: (id: string, status: string, resolution?: string) =>
    api.patch<ApiResponse<RequestItem>>(`/requests/${id}/status`, { status, resolution }),
  exportCsv: async (): Promise<string> => {
    const token = getAccessToken();
    const response = await fetch(`${API_URL}/requests/export/csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new ApiError(response.status, 'Falha ao exportar');
    return response.text();
  },
};

export const ticketsApi = {
  list: (params?: { status?: string; page?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    const qs = query.toString();
    return api.get<ApiResponse<PaginatedResponse<Ticket>>>(`/tickets${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api.get<ApiResponse<Ticket>>(`/tickets/${id}`),
  create: (data: Record<string, unknown>) => api.post<ApiResponse<Ticket>>('/tickets', data),
  reply: (id: string, content: string) =>
    api.post<ApiResponse<TicketMessage>>(`/tickets/${id}/messages`, { content }),
};

export const commissionsApi = {
  list: (params?: { status?: string; page?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    const qs = query.toString();
    return api.get<ApiResponse<PaginatedResponse<Commission>>>(`/commissions${qs ? `?${qs}` : ''}`);
  },
  summary: () =>
    api.get<
      ApiResponse<{
        forecast: number;
        approved: number;
        paid: number;
        total: number;
      }>
    >('/commissions/summary'),
};

export const profileApi = {
  get: () => api.get<ApiResponse<UserProfile>>('/profile'),
  update: (data: Partial<UserProfile>) => api.put<ApiResponse<UserProfile>>('/profile', data),
  updatePartner: (data: Partial<PartnerProfile>) =>
    api.put<ApiResponse<PartnerProfile>>('/profile/partner', data),
};

export { API_URL };
