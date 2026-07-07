import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthUser, LoginRequest } from '@luxus/types';
import {
  login as authLogin,
  logout as authLogout,
  restoreSession,
  biometricLogin,
  setBiometricEnabled,
  isBiometricEnabled,
  isBiometricAvailable,
  getRememberEmail,
  initAuthService,
} from '@/services/auth';
import { connectSocket, disconnectSocket } from '@/services/socket';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  loginWithBiometric: () => Promise<void>;
  toggleBiometric: (enabled: boolean) => Promise<void>;
  refreshUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabledState, setBiometricEnabledState] = useState(false);

  useEffect(() => {
    initAuthService();

    async function bootstrap() {
      try {
        const [available, enabled, session] = await Promise.all([
          isBiometricAvailable(),
          isBiometricEnabled(),
          restoreSession(),
        ]);
        setBiometricAvailable(available);
        setBiometricEnabledState(enabled);
        if (session) {
          setUser(session);
          connectSocket();
        }
      } finally {
        setIsLoading(false);
      }
    }

    bootstrap();
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    const result = await authLogin(credentials);
    setUser(result.user);
    connectSocket();
  }, []);

  const logout = useCallback(async () => {
    disconnectSocket();
    await authLogout();
    setUser(null);
  }, []);

  const loginWithBiometric = useCallback(async () => {
    const session = await biometricLogin();
    if (session) {
      setUser(session);
      connectSocket();
    }
  }, []);

  const toggleBiometric = useCallback(async (enabled: boolean) => {
    await setBiometricEnabled(enabled);
    setBiometricEnabledState(enabled);
  }, []);

  const refreshUser = useCallback((updatedUser: AuthUser) => {
    setUser(updatedUser);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      biometricAvailable,
      biometricEnabled: biometricEnabledState,
      login,
      logout,
      loginWithBiometric,
      toggleBiometric,
      refreshUser,
    }),
    [
      user,
      isLoading,
      biometricAvailable,
      biometricEnabledState,
      login,
      logout,
      loginWithBiometric,
      toggleBiometric,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export { getRememberEmail };
