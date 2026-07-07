import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  UserRole,
  type AuthUser,
  type Permission,
} from '@luxus/types';

/** Permissão exigida para acessar cada rota do painel. */
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/dashboard': PERMISSIONS.DASHBOARD_READ,
  '/clientes': PERMISSIONS.CLIENTS_READ,
  '/filiais': PERMISSIONS.BRANCHES_READ,
  '/parceiros': PERMISSIONS.PARTNERS_READ,
  '/operadoras': PERMISSIONS.OPERATORS_WRITE,
  '/planos': PERMISSIONS.PLANS_WRITE,
  '/estoque': PERMISSIONS.STOCK_READ,
  '/vendas': PERMISSIONS.SALES_READ,
  '/comissoes': PERMISSIONS.COMMISSIONS_READ,
  '/chamados': PERMISSIONS.TICKETS_READ,
  '/financeiro': PERMISSIONS.FINANCIAL_READ,
  '/campanhas': PERMISSIONS.CAMPAIGNS_READ,
  '/usuarios': PERMISSIONS.USERS_READ,
  '/auditoria': PERMISSIONS.AUDIT_READ,
  '/solicitacoes': PERMISSIONS.REQUESTS_READ,
  '/perfil': PERMISSIONS.DASHBOARD_READ,
};

export function getUserPermissions(user: AuthUser | null): string[] {
  if (!user) return [];
  if (user.permissions?.length) return user.permissions;
  return ROLE_PERMISSIONS[user.role] ?? [];
}

export function hasPermission(user: AuthUser | null, permission: Permission): boolean {
  return getUserPermissions(user).includes(permission);
}

export function canAccessRoute(user: AuthUser | null, pathname: string): boolean {
  const entry = Object.entries(ROUTE_PERMISSIONS).find(
    ([route]) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!entry) return true;
  return hasPermission(user, entry[1]);
}

export function isAdminUser(user: AuthUser | null): boolean {
  return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERVISOR;
}

export function isPartnerUser(user: AuthUser | null): boolean {
  return user?.role === UserRole.PARTNER;
}
