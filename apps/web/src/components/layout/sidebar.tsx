'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Settings,
  LogOut,
} from 'lucide-react';
import { LuxusLogo } from '@/components/brand/luxus-logo';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { canAccessRoute, isAttendantUser, isPartnerUser } from '@/lib/rbac';
import { getInitials } from '@luxus/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const adminNavItems = [
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

const partnerNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: User },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { href: '/filiais', label: 'Filiais', icon: Store },
  { href: '/estoque', label: 'Estoque', icon: Warehouse },
  { href: '/solicitacoes', label: 'Solicitações', icon: FileText },
  { href: '/chamados', label: 'Chamados', icon: MessageSquare },
  { href: '/comissoes', label: 'Comissões', icon: DollarSign },
];

const attendantNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: User },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { href: '/solicitacoes', label: 'Solicitações', icon: FileText },
  { href: '/chamados', label: 'Chamados', icon: MessageSquare },
];

function NavIcon({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200',
        isActive
          ? 'bg-white/12 text-white shadow-inner'
          : 'text-white/45 hover:bg-white/8 hover:text-white/80',
      )}
      title={label}
    >
      <Icon className="h-5 w-5" />
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const navItems = isAttendantUser(user)
    ? attendantNavItems
    : isPartnerUser(user)
      ? partnerNavItems
      : adminNavItems;
  const visibleItems = navItems.filter((item) => canAccessRoute(user, item.href));
  const isPerfilActive = pathname === '/perfil';
  const isConfigActive = pathname === '/configuracoes';

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[88px] flex-col items-center border-r border-white/5 bg-[#111827] py-5">
      <Link
        href="/dashboard"
        className="mb-8 flex items-center justify-center"
        title="Luxus Parceiros"
      >
        <LuxusLogo variant="full" forceDark className="h-9 w-[72px] max-w-[72px]" />
      </Link>

      <ScrollArea className="flex-1 w-full">
        <nav className="flex flex-col items-center gap-2 px-3">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <NavIcon
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={isActive}
              />
            );
          })}
        </nav>
      </ScrollArea>

      <div className="mt-4 flex flex-col items-center gap-3">
        <Link
          href="/configuracoes"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-2xl transition-colors',
            isConfigActive
              ? 'bg-white/12 text-white'
              : 'text-white/45 hover:bg-white/8 hover:text-white/80',
          )}
          title="Configurações"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-white/45 transition-colors hover:bg-red-500/15 hover:text-red-300"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
        <Link
          href="/perfil"
          title="Perfil"
          className={cn(
            'rounded-full transition-opacity hover:opacity-90',
            isPerfilActive && 'ring-2 ring-primary ring-offset-2 ring-offset-[#111827]',
          )}
        >
          <Avatar className="h-10 w-10 border-2 border-white/10">
            <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
              {user ? getInitials(user.name) : 'LP'}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </aside>
  );
}
