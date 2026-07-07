const ACCESS_TOKEN_KEY = 'luxus_access_token';
const REFRESH_TOKEN_KEY = 'luxus_refresh_token';
const USER_KEY = 'luxus_user';
const REMEMBER_KEY = 'luxus_remember';

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: string;
  partnerId?: string;
  permissions: string[];
}

function getStorage(remember: boolean): Storage {
  return remember ? localStorage : sessionStorage;
}

function getActiveStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  const remember = localStorage.getItem(REMEMBER_KEY) === 'true';
  return getStorage(remember);
}

export function setTokens(
  accessToken: string,
  refreshToken: string,
  remember = false,
): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REMEMBER_KEY, String(remember));
  const storage = getStorage(remember);
  storage.setItem(ACCESS_TOKEN_KEY, accessToken);
  storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function getAccessToken(): string | null {
  const storage = getActiveStorage();
  if (!storage) return null;
  return storage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  const storage = getActiveStorage();
  if (!storage) return null;
  return storage.getItem(REFRESH_TOKEN_KEY);
}

export function setUser(user: StoredUser): void {
  if (typeof window === 'undefined') return;
  const remember = localStorage.getItem(REMEMBER_KEY) === 'true';
  getStorage(remember).setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): StoredUser | null {
  const storage = getActiveStorage();
  if (!storage) return null;
  const raw = storage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  [localStorage, sessionStorage].forEach((s) => {
    s.removeItem(ACCESS_TOKEN_KEY);
    s.removeItem(REFRESH_TOKEN_KEY);
    s.removeItem(USER_KEY);
  });
  localStorage.removeItem(REMEMBER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

export function setCookie(name: string, value: string, days = 7): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function removeCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}
