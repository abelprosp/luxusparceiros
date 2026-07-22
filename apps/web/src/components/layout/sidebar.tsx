'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Settings, LogOut } from 'lucide-react';
import { LuxusLogo } from '@/components/brand/luxus-logo';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { getVisibleNavItems } from '@/components/layout/nav-config';
import { UserAvatar } from '@/components/profile/user-avatar';

const SIDEBAR_SCROLL_KEY = 'luxus:sidebar-scroll-position';

function NavIcon({
  href,
  label,
  icon: Icon,
  isActive,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
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
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[88px] flex-col items-center border-r border-white/5 bg-[#111827] py-5 lg:flex">
      <Link
        href="/dashboard"
        className="mb-8 flex items-center justify-center"
        title="Luxus Parceiros"
      >
        <LuxusLogo variant="full" forceDark className="h-9 w-[72px] max-w-[72px]" />
      </Link>

      <div ref={scrollRootRef} className="relative min-h-0 w-full flex-1">
        <ScrollArea className="h-full w-full">
          <nav className="flex flex-col items-center gap-2 px-3 pb-14">
            {visibleItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <NavIcon
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={isActive}
                  onNavigate={preserveScrollPosition}
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
          <UserAvatar
            name={user?.name}
            avatar={user?.avatar}
            className="h-10 w-10 border-2 border-white/10"
            fallbackClassName="bg-primary/20 text-xs text-primary"
          />
        </Link>
      </div>
    </aside>
  );
}
