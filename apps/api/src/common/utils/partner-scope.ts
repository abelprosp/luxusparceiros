import { ForbiddenException } from '@nestjs/common';
import { AuthUser, UserRole } from '@luxus/types';
import { MESSAGES } from '../constants/messages';

export function isAdminRole(role: UserRole): boolean {
  return [UserRole.ADMIN, UserRole.SUPERVISOR].includes(role);
}

export function resolvePartnerId(user: AuthUser, requestedPartnerId?: string): string | undefined {
  if (isAdminRole(user.role)) {
    return requestedPartnerId;
  }
  if (!user.partnerId) {
    throw new ForbiddenException(MESSAGES.PARTNER_SCOPE_REQUIRED);
  }
  return user.partnerId;
}

export function assertPartnerAccess(user: AuthUser, partnerId: string): void {
  if (isAdminRole(user.role)) return;
  if (user.partnerId !== partnerId) {
    throw new ForbiddenException(MESSAGES.FORBIDDEN);
  }
}
