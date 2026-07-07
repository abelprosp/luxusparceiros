import type {
  ApiResponse,
  AuthTokens,
  AuthUser,
  LoginRequest,
  PaginatedResponse,
} from '@luxus/types';
import {
  clearAuth,
  getAccessToken,
  getRefreshToken,
  setTokens,
  setUser,
  type StoredUser,
} from './auth';

function normalizeApiBase(url: string): string {
  return url.replace(/\/$/, '').replace(/\/api$/, '');
}

const API_BASE = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
const API_URL = `${API_BASE}/api`;
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || `${API_BASE}/events`;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearAuth();
      return null;
    }

    const json = (await res.json()) as ApiResponse<AuthTokens>;
    if (json.data) {
      const remember = localStorage.getItem('luxus_remember') === 'true';
      setTokens(json.data.accessToken, json.data.refreshToken, remember);
      return json.data.accessToken;
    }
    return null;
  } catch {
    clearAuth();
    return null;
  }
}

async function getValidToken(): Promise<string | null> {
  const token = getAccessToken();
  if (token) return token;

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  auth?: boolean;
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const url = new URL(path.startsWith('http') ? path : `${API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, params, auth = true, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
  ...(customHeaders as Record<string, string>),
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = await getValidToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(buildUrl(path, params), {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      const retry = await fetch(buildUrl(path, params), {
        ...rest,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return handleResponse<T>(retry);
    }
    clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiError('Sessão expirada', 401);
  }

  return handleResponse<T>(res);
}

async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      (data as ApiResponse)?.error ||
      (data as ApiResponse)?.message ||
      `Erro ${res.status}`;
    throw new ApiError(message, res.status, data);
  }

  if (isJson && (data as ApiResponse).data !== undefined) {
    return (data as ApiResponse<T>).data as T;
  }

  return data as T;
}

export async function login(credentials: LoginRequest): Promise<{
  user: AuthUser;
  tokens: AuthTokens;
}> {
  const result = await api<AuthTokens & { user: AuthUser }>(
    '/auth/login',
    { method: 'POST', body: credentials, auth: false },
  );

  const tokens: AuthTokens = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
  };

  setTokens(tokens.accessToken, tokens.refreshToken, credentials.rememberMe);
  setUser(result.user as StoredUser);

  return { user: result.user, tokens };
}

export async function logout(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch {
    // ignore
  } finally {
    clearAuth();
  }
}

export async function getMe(): Promise<AuthUser> {
  return api<AuthUser>('/auth/me');
}

export async function getPaginated<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<PaginatedResponse<T>> {
  return api<PaginatedResponse<T>>(path, { params });
}

export async function uploadFile(
  file: File,
  type: string,
  relations?: { saleId?: string; clientId?: string },
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  if (relations?.saleId) formData.append('saleId', relations.saleId);
  if (relations?.clientId) formData.append('clientId', relations.clientId);

  const token = await getValidToken();
  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      (data as ApiResponse)?.error || (data as ApiResponse)?.message || 'Falha no upload',
      res.status,
      data,
    );
  }

  return handleResponse<unknown>(res);
}

export { API_URL, API_BASE, WS_URL };
