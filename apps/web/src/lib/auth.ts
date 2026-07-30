const ACCESS_TOKEN_KEY = 'luxus_access_token';
const REFRESH_TOKEN_KEY = 'luxus_refresh_token';
const USER_KEY = 'luxus_user';
const REMEMBER_KEY = 'luxus_remember';

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  partnerId?: string;
  partnerName?: string;
  branchId?: string;
  branchName?: string;
  permissions: string[];
}

function migrateLegacySession(): void {
  if (typeof window === 'undefined') return;
  [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY].forEach((key) => {
    const legacyValue = sessionStorage.getItem(key);
    if (!localStorage.getItem(key) && legacyValue) {
      localStorage.setItem(key, legacyValue);
    }
    sessionStorage.removeItem(key);
  });
  localStorage.setItem(REMEMBER_KEY, 'true');
}

function getActiveStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  migrateLegacySession();
  return localStorage;
}

export function setTokens(
  accessToken: string,
  refreshToken: string,
  _remember = true,
): void {
  if (typeof window === 'undefined') return;
  migrateLegacySession();
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
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
  migrateLegacySession();
  localStorage.setItem(USER_KEY, JSON.stringify(user));
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
