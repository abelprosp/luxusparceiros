import { AuthUser, UserRole } from '@luxus/types';

export const BANK_FIELDS = ['bankName', 'bankAgency', 'bankAccount', 'pixKey', 'pixKeyType'] as const;
export type BankField = (typeof BANK_FIELDS)[number];

/** Dados bancários/PIX ficam restritos ao administrador e ao titular do parceiro. */
export function canAccessBankData(user: Pick<AuthUser, 'role'>): boolean {
  return user.role === UserRole.ADMIN || user.role === UserRole.PARTNER;
}

export function maskBankData<T extends object>(
  partner: T,
  user?: Pick<AuthUser, 'role'>,
): T & { bankDataRestricted: boolean } {
  if (!user || canAccessBankData(user)) return { ...partner, bankDataRestricted: false };
  const masked: Record<string, unknown> = { ...partner, bankDataRestricted: true };
  for (const field of BANK_FIELDS) {
    if (field in masked) masked[field] = null;
  }
  return masked as T & { bankDataRestricted: boolean };
}
