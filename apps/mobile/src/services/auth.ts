import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import type { AuthTokens, AuthUser, LoginRequest } from '@luxus/types';
import { authApi, setAccessToken, setRefreshCallback } from './api';

const TOKEN_KEY = 'luxus_access_token';
const REFRESH_KEY = 'luxus_refresh_token';
const USER_KEY = 'luxus_user';
const BIOMETRIC_KEY = 'luxus_biometric_enabled';
const REMEMBER_KEY = 'luxus_remember_email';

export async function storeTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
  setAccessToken(tokens.accessToken);
}

export async function getStoredTokens(): Promise<AuthTokens | null> {
  const accessToken = await SecureStore.getItemAsync(TOKEN_KEY);
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken, expiresIn: 0 };
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  setAccessToken(null);
}

export async function storeUser(user: AuthUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const data = await SecureStore.getItemAsync(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as AuthUser;
  } catch {
    return null;
  }
}

export async function clearUser(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? 'true' : 'false');
}

export async function isBiometricEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRIC_KEY);
  return value === 'true';
}

export async function setRememberEmail(email: string): Promise<void> {
  await SecureStore.setItemAsync(REMEMBER_KEY, email);
}

export async function getRememberEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(REMEMBER_KEY);
}

export async function clearRememberEmail(): Promise<void> {
  await SecureStore.deleteItemAsync(REMEMBER_KEY);
}

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return compatible && enrolled;
}

export async function authenticateWithBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Autentique-se para acessar Luxus Parceiros',
    cancelLabel: 'Cancelar',
    fallbackLabel: 'Usar senha',
    disableDeviceFallback: false,
  });
  return result.success;
}

export async function login(credentials: LoginRequest): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const response = await authApi.login(credentials);
  if (!response.success || !response.data) {
    throw new Error(response.error ?? response.message ?? 'Falha no login');
  }

  const data = response.data as unknown as AuthTokens & { user: AuthUser };
  const { user, accessToken, refreshToken, expiresIn } = data;
  const tokens: AuthTokens = { accessToken, refreshToken, expiresIn };

  await storeTokens(tokens);
  await storeUser(user);

  if (credentials.rememberMe) {
    await setRememberEmail(credentials.email);
  } else {
    await clearRememberEmail();
  }

  return { user, tokens };
}

export async function refreshTokens(): Promise<AuthTokens | null> {
  const stored = await getStoredTokens();
  if (!stored?.refreshToken) return null;

  try {
    const response = await authApi.refresh(stored.refreshToken);
    if (!response.success || !response.data) return null;
    await storeTokens(response.data);
    return response.data;
  } catch {
    await logout();
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    // ignore logout API errors
  }
  await clearTokens();
  await clearUser();
}

export async function restoreSession(): Promise<AuthUser | null> {
  const tokens = await getStoredTokens();
  if (!tokens) return null;

  setAccessToken(tokens.accessToken);
  setRefreshCallback(refreshTokens);

  const storedUser = await getStoredUser();
  if (storedUser) return storedUser;

  try {
    const response = await authApi.me();
    if (response.success && response.data) {
      await storeUser(response.data);
      return response.data;
    }
  } catch {
    const refreshed = await refreshTokens();
    if (refreshed) {
      const retry = await authApi.me();
      if (retry.success && retry.data) {
        await storeUser(retry.data);
        return retry.data;
      }
    }
  }

  await logout();
  return null;
}

export async function biometricLogin(): Promise<AuthUser | null> {
  const enabled = await isBiometricEnabled();
  if (!enabled) throw new Error('Biometria não está habilitada');

  const tokens = await getStoredTokens();
  if (!tokens) throw new Error('Nenhuma sessão salva. Faça login com e-mail e senha primeiro.');

  const authenticated = await authenticateWithBiometric();
  if (!authenticated) return null;

  setAccessToken(tokens.accessToken);
  setRefreshCallback(refreshTokens);

  const user = await getStoredUser();
  if (user) return user;

  const response = await authApi.me();
  if (response.success && response.data) {
    await storeUser(response.data);
    return response.data;
  }

  return null;
}

export function initAuthService(): void {
  setRefreshCallback(refreshTokens);
}
