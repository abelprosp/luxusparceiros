import { ForbiddenException } from '@nestjs/common';
import { AuthUser, UserRole } from '@luxus/types';
import { MESSAGES } from '../constants/messages';

export function isAdminRole(role: UserRole): boolean {
  return [UserRole.ADMIN, UserRole.SUPERVISOR].includes(role);
}

/** Administrador da plataforma não possui vínculo com um parceiro comercial. */
export function isPlatformAdmin(user: AuthUser): boolean {
  return isAdminRole(user.role) && !user.partnerId;
}

export function resolvePartnerId(user: AuthUser, requestedPartnerId?: string): string | undefined {
  if (user.partnerId) {
    if (requestedPartnerId && requestedPartnerId !== user.partnerId) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }
    return user.partnerId;
  }
  if (isAdminRole(user.role) || user.role === UserRole.FINANCIAL) {
    return requestedPartnerId;
  }
  throw new ForbiddenException(MESSAGES.PARTNER_SCOPE_REQUIRED);
}

export function assertPartnerAccess(user: AuthUser, partnerId: string): void {
  if (isPlatformAdmin(user) || (user.role === UserRole.FINANCIAL && !user.partnerId)) return;
  if (user.partnerId !== partnerId) {
    throw new ForbiddenException(MESSAGES.FORBIDDEN);
  }
}
