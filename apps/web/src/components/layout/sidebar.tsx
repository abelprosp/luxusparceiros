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

const NAV_GROUPS = [
  { label: 'Principal', paths: ['/dashboard'] },
  { label: 'Gestão', paths: ['/parceiros', '/usuarios', '/clientes', '/filiais'] },
  {
    label: 'Operação',
    paths: [
      '/solicitacoes',
      '/operadoras',
      '/planos',
      '/estoque',
      '/vendas',
      '/comissoes',
      '/financeiro',
      '/campanhas',
      '/auditoria',
    ],
  },
  { label: 'Ajuda', paths: ['/guia-de-uso'] },
] as const;

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
        'group relative flex h-11 items-center transition-all duration-200',
        expanded
          ? 'w-full justify-start gap-3 rounded-xl px-3 text-sm font-medium'
          : 'w-11 justify-center rounded-2xl',
        isActive
          ? expanded
            ? 'bg-primary/15 text-white shadow-[inset_0_0_0_1px_rgba(59,130,246,0.16)]'
            : 'bg-white/12 text-white shadow-inner'
          : expanded
            ? 'text-white/55 hover:bg-white/8 hover:text-white'
            : 'text-white/45 hover:bg-white/8 hover:text-white/80',
      )}
      title={expanded ? undefined : label}
      aria-current={isActive ? 'page' : undefined}
    >
      {isActive && expanded && (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
      )}
      <Icon
        className={cn(
          'shrink-0 transition-colors',
          expanded ? 'h-[18px] w-[18px]' : 'h-5 w-5',
          expanded && (isActive ? 'text-primary' : 'text-white/55 group-hover:text-white'),
        )}
      />
      {expanded && <span className="truncate">{label}</span>}
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
  const groupedItems = NAV_GROUPS.map((group) => ({
    ...group,
    items: visibleItems.filter((item) =>
      (group.paths as readonly string[]).includes(item.href),
    ),
  })).filter((group) => group.items.length > 0);

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
        'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-white/5 bg-[#111827] transition-[width] duration-300 lg:flex',
        !expanded && 'py-4',
        expanded ? 'w-[272px] items-stretch' : 'w-[88px] items-center',
      )}
    >
      <div
        className={cn(
          'relative flex w-full items-center',
          expanded
            ? 'h-[88px] shrink-0 justify-start border-b border-white/[0.04] px-4'
            : 'mb-5 h-16 justify-center px-3',
        )}
      >
        <Link
          href="/dashboard"
          className={cn(
            'flex h-full items-center overflow-hidden',
            expanded ? 'justify-start' : 'justify-center',
          )}
          title="Luxus Parceiros"
        >
          <LuxusLogo
            variant={expanded ? 'full' : 'icon'}
            forceDark
            className={expanded ? 'h-11 max-w-[180px]' : 'h-14 w-14'}
          />
        </Link>
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          className={cn(
            'absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-center border shadow-lg transition',
            expanded
              ? 'right-4 h-8 w-8 rounded-xl border-white/10 bg-white/[0.04] text-white/65 hover:border-white/20 hover:bg-white/10 hover:text-white'
              : '-right-3 h-7 w-7 rounded-full border-white/15 bg-[#1b2638] text-white/75 hover:bg-[#243249] hover:text-white',
          )}
          aria-label={expanded ? 'Recolher menu lateral' : 'Expandir menu lateral'}
          title={expanded ? 'Usar menu com ícones' : 'Usar menu com nomes'}
        >
          {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      <div ref={scrollRootRef} className="relative min-h-0 w-full flex-1">
        <ScrollArea
          className={cn(
            'h-full w-full',
            expanded &&
              '[&_[data-radix-scroll-area-scrollbar]]:w-1.5 [&_[data-radix-scroll-area-thumb]]:bg-white/15',
          )}
        >
          <nav
            className={cn(
              'flex flex-col px-3',
              expanded ? 'items-stretch py-4' : 'items-center gap-2 pb-14',
            )}
          >
            {expanded ? groupedItems.map((group, groupIndex) => (
              <div
                key={group.label}
                className={cn(
                  'flex w-full flex-col',
                  expanded ? 'gap-1' : 'items-center gap-1',
                  groupIndex > 0 && (expanded ? 'mt-5' : 'mt-2 border-t border-white/5 pt-2'),
                )}
              >
                {expanded && (
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
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
              </div>
            )) : visibleItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={isActive}
                  onNavigate={preserveScrollPosition}
                  expanded={false}
                />
              );
            })}
          </nav>
        </ScrollArea>
        {hasMoreItems && !expanded && (
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
          'flex w-full flex-col px-3',
          expanded
            ? 'shrink-0 items-stretch gap-1 border-t border-white/[0.06] bg-[#111827] py-3'
            : 'mt-4 items-center gap-3',
        )}
      >
        <Link
          href="/configuracoes"
          className={cn(
            'flex h-10 items-center transition-colors',
            expanded
              ? 'w-full justify-start gap-3 rounded-xl px-3 text-sm font-medium'
              : 'w-10 justify-center rounded-2xl',
            isConfigActive
              ? expanded
                ? 'bg-primary/15 text-white'
                : 'bg-white/12 text-white'
              : expanded
                ? 'text-white/55 hover:bg-white/8 hover:text-white'
                : 'text-white/45 hover:bg-white/8 hover:text-white/80',
          )}
          title={expanded ? undefined : 'Configurações'}
        >
          <Settings
            className={cn(
              expanded ? 'h-[18px] w-[18px]' : 'h-4 w-4',
              expanded && isConfigActive && 'text-primary',
            )}
          />
          {expanded && <span>Configurações</span>}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            'flex h-10 items-center transition-colors hover:bg-red-500/15 hover:text-red-300',
            expanded
              ? 'w-full justify-start gap-3 rounded-xl px-3 text-sm font-medium text-white/55'
              : 'w-10 justify-center rounded-2xl text-white/45',
          )}
          title={expanded ? undefined : 'Sair'}
        >
          <LogOut className={expanded ? 'h-[18px] w-[18px]' : 'h-4 w-4'} />
          {expanded && <span>Sair</span>}
        </button>
        {expanded && <div className="my-1 h-px w-full bg-white/[0.05]" />}
        <Link
          href="/perfil"
          title={expanded ? undefined : 'Perfil'}
          className={cn(
            'transition-opacity hover:opacity-90',
            expanded
              ? 'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-white/80 hover:bg-white/8'
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
