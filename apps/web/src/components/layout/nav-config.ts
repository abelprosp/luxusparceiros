import {
  LayoutDashboard,
  Users,
  Radio,
  Package,
  Warehouse,
  ShoppingCart,
  DollarSign,
  MessageSquare,
  Wallet,
  Megaphone,
  UserCog,
  ClipboardList,
  FileText,
  User,
  Store,
} from 'lucide-react';
import type { AuthUser } from '@luxus/types';
import { canAccessRoute, isAttendantUser, isPartnerUser } from '@/lib/rbac';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const adminNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/parceiros', label: 'Parceiros', icon: Users },
  { href: '/usuarios', label: 'Usuários', icon: UserCog },
  { href: '/solicitacoes', label: 'Solicitações', icon: FileText },
  { href: '/operadoras', label: 'Operadoras', icon: Radio },
  { href: '/planos', label: 'Planos', icon: Package },
  { href: '/estoque', label: 'Estoque', icon: Warehouse },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { href: '/comissoes', label: 'Comissões', icon: DollarSign },
  { href: '/chamados', label: 'Chamados', icon: MessageSquare },
  { href: '/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/campanhas', label: 'Campanhas', icon: Megaphone },
  { href: '/auditoria', label: 'Auditoria', icon: ClipboardList },
];

export const partnerNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: User },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { href: '/filiais', label: 'Filiais', icon: Store },
  { href: '/estoque', label: 'Estoque', icon: Warehouse },
  { href: '/solicitacoes', label: 'Solicitações', icon: FileText },
  { href: '/chamados', label: 'Chamados', icon: MessageSquare },
  { href: '/comissoes', label: 'Comissões', icon: DollarSign },
];

export const attendantNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: User },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { href: '/solicitacoes', label: 'Solicitações', icon: FileText },
  { href: '/chamados', label: 'Chamados', icon: MessageSquare },
];

export function getNavItems(user: AuthUser | null): NavItem[] {
  if (isAttendantUser(user)) return attendantNavItems;
  if (isPartnerUser(user)) return partnerNavItems;
  return adminNavItems;
}

export function getVisibleNavItems(user: AuthUser | null): NavItem[] {
  return getNavItems(user).filter((item) => canAccessRoute(user, item.href));
}
