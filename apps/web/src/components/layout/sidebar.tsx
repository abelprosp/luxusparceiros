'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight, Settings, LogOut } from 'lucide-react';
import { LuxusLogo } from '@/components/brand/luxus-logo';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { getVisibleNavItems } from '@/components/layout/nav-config';
import { UserAvatar } from '@/components/profile/user-avatar';

const SIDEBAR_SCROLL_KEY = 'luxus:sidebar-scroll-position';

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  onNavigate,
  expanded,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onNavigate: () => void;
  expanded: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'flex h-11 items-center rounded-2xl transition-all duration-200',
        expanded ? 'w-full justify-start px-4 text-sm font-medium' : 'w-11 justify-center',
        isActive
          ? 'bg-white/12 text-white shadow-inner'
          : 'text-white/45 hover:bg-white/8 hover:text-white/80',
      )}
      title={expanded ? undefined : label}
    >
      {expanded ? <span className="truncate">{label}</span> : <Icon className="h-5 w-5" />}
    </Link>
  );
}

interface SidebarProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function Sidebar({ expanded, onExpandedChange }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const visibleItems = getVisibleNavItems(user);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const [hasMoreItems, setHasMoreItems] = useState(false);
  const isPerfilActive = pathname === '/perfil';
  const isConfigActive = pathname === '/configuracoes';

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const updateScrollHint = useCallback(() => {
    const viewport = scrollRootRef.current?.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]',
    );
    if (!viewport) return;
    setHasMoreItems(viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 4);
  }, []);

  const preserveScrollPosition = useCallback(() => {
    const viewport = scrollRootRef.current?.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]',
    );
    if (viewport) {
      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(viewport.scrollTop));
    }
  }, []);

  useLayoutEffect(() => {
    const viewport = scrollRootRef.current?.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]',
    );
    if (!viewport) return;

    const savedPosition = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY) ?? 0);
    if (Number.isFinite(savedPosition)) {
      viewport.scrollTop = savedPosition;
    }
    updateScrollHint();
  }, [pathname, updateScrollHint]);

  useEffect(() => {
    const viewport = scrollRootRef.current?.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]',
    );
    if (!viewport) return;
    updateScrollHint();
    viewport.addEventListener('scroll', updateScrollHint);
    window.addEventListener('resize', updateScrollHint);
    return () => {
      viewport.removeEventListener('scroll', updateScrollHint);
      window.removeEventListener('resize', updateScrollHint);
    };
  }, [updateScrollHint, visibleItems.length]);

  const scrollToMoreItems = () => {
    const viewport = scrollRootRef.current?.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]',
    );
    viewport?.scrollBy({ top: 180, behavior: 'smooth' });
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-white/5 bg-[#111827] py-4 transition-[width] duration-300 lg:flex',
        expanded ? 'w-[272px] items-stretch' : 'w-[88px] items-center',
      )}
    >
      <div className="relative mb-5 flex h-16 w-full items-center justify-center px-3">
        <Link
          href="/dashboard"
          className="flex h-full items-center justify-center overflow-hidden"
          title="Luxus Parceiros"
        >
          <LuxusLogo
            variant={expanded ? 'full' : 'icon'}
            forceDark
            className={expanded ? 'h-12 max-w-[205px]' : 'h-14 w-14'}
          />
        </Link>
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          className="absolute -right-3 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#1b2638] text-white/75 shadow-lg transition hover:bg-[#243249] hover:text-white"
          aria-label={expanded ? 'Recolher menu lateral' : 'Expandir menu lateral'}
          title={expanded ? 'Usar menu com ícones' : 'Usar menu com nomes'}
        >
          {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      <div ref={scrollRootRef} className="relative min-h-0 w-full flex-1">
        <ScrollArea className="h-full w-full">
          <nav
            className={cn(
              'flex flex-col gap-2 px-3 pb-14',
              expanded ? 'items-stretch' : 'items-center',
            )}
          >
            {visibleItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={isActive}
                  onNavigate={preserveScrollPosition}
                  expanded={expanded}
                />
              );
            })}
          </nav>
        </ScrollArea>
        {hasMoreItems && (
          <button
            type="button"
            onClick={scrollToMoreItems}
            className="absolute inset-x-2 bottom-0 flex flex-col items-center rounded-xl bg-[#111827]/95 py-1.5 text-[10px] font-medium text-white/80 shadow-[0_-10px_18px_#111827] transition hover:text-white"
            aria-label="Mostrar mais opções do menu"
          >
            Mais opções
            <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
          </button>
        )}
      </div>

      <div
        className={cn(
          'mt-4 flex w-full flex-col gap-3 px-3',
          expanded ? 'items-stretch' : 'items-center',
        )}
      >
        <Link
          href="/configuracoes"
          className={cn(
            'flex h-10 items-center rounded-2xl transition-colors',
            expanded ? 'w-full justify-start px-4 text-sm font-medium' : 'w-10 justify-center',
            isConfigActive
              ? 'bg-white/12 text-white'
              : 'text-white/45 hover:bg-white/8 hover:text-white/80',
          )}
          title={expanded ? undefined : 'Configurações'}
        >
          {expanded ? <span>Configurações</span> : <Settings className="h-4 w-4" />}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            'flex h-10 items-center rounded-2xl text-white/45 transition-colors hover:bg-red-500/15 hover:text-red-300',
            expanded ? 'w-full justify-start px-4 text-sm font-medium' : 'w-10 justify-center',
          )}
          title={expanded ? undefined : 'Sair'}
        >
          {expanded ? <span>Sair</span> : <LogOut className="h-4 w-4" />}
        </button>
        <Link
          href="/perfil"
          title={expanded ? undefined : 'Perfil'}
          className={cn(
            'transition-opacity hover:opacity-90',
            expanded
              ? 'flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-white/80 hover:bg-white/8'
              : 'rounded-full',
            isPerfilActive && 'ring-2 ring-primary ring-offset-2 ring-offset-[#111827]',
          )}
        >
          <UserAvatar
            name={user?.name}
            avatar={user?.avatar}
            className="h-10 w-10 border-2 border-white/10"
            fallbackClassName="bg-primary/20 text-xs text-primary"
          />
          {expanded && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user?.name ?? 'Perfil'}</p>
              <p className="truncate text-xs text-white/45">{user?.email}</p>
            </div>
          )}
        </Link>
      </div>
    </aside>
  );
}
