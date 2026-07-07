'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser, LoginRequest } from '@luxus/types';
import { getMe, login as apiLogin, logout as apiLogout } from '@/lib/api';
import {
  clearAuth,
  getUser,
  isAuthenticated,
  setUser,
  type StoredUser,
} from '@/lib/auth';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!isAuthenticated()) {
      setUserState(null);
      return;
    }
    try {
      const me = await getMe();
      setUserState(me);
      setUser(me as StoredUser);
    } catch {
      const stored = getUser();
      if (stored) {
        setUserState(stored as AuthUser);
      } else {
        clearAuth();
        setUserState(null);
      }
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const stored = getUser();
      if (stored) setUserState(stored as AuthUser);
      if (isAuthenticated()) {
        await refreshUser();
      }
      setIsLoading(false);
    };
    init();
  }, [refreshUser]);

  const login = useCallback(async (credentials: LoginRequest) => {
    const result = await apiLogin(credentials);
    setUserState(result.user);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUserState(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user && isAuthenticated(),
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
