'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ChevronLeft,
  ChevronRight,
  Zap,
  User,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { canAccessRoute, isPartnerUser } from '@/lib/rbac';

const adminNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/parceiros', label: 'Parceiros', icon: Users },
  { href: '/operadoras', label: 'Operadoras', icon: Radio },
  { href: '/planos', label: 'Planos', icon: Package },
  { href: '/estoque', label: 'Estoque', icon: Warehouse },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { href: '/comissoes', label: 'Comissões', icon: DollarSign },
  { href: '/chamados', label: 'Chamados', icon: MessageSquare },
  { href: '/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/campanhas', label: 'Campanhas', icon: Megaphone },
  { href: '/usuarios', label: 'Usuários', icon: UserCog },
  { href: '/auditoria', label: 'Auditoria', icon: ClipboardList },
  { href: '/solicitacoes', label: 'Solicitações', icon: FileText },
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
  { href: '/perfil', label: 'Perfil', icon: UserCog },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const navItems = isPartnerUser(user) ? partnerNavItems : adminNavItems;
  const visibleItems = navItems.filter((item) => canAccessRoute(user, item.href));

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <p className="text-sm font-bold leading-tight">Luxus</p>
            <p className="text-xs text-muted-foreground">Parceiros</p>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-3">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-soft'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-t p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
