'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Settings } from 'lucide-react';
import { LuxusLogo } from '@/components/brand/luxus-logo';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { getInitials } from '@luxus/utils';
import { cn } from '@/lib/utils';
import { getVisibleNavItems } from '@/components/layout/nav-config';
import { useMobileNav } from '@/components/layout/mobile-nav-context';

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { open, setOpen } = useMobileNav();
  const visibleItems = getVisibleNavItems(user);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.push('/login');
  };

  const navigate = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="gap-0 p-0">
        <SheetHeader className="border-b px-5 py-5">
          <LuxusLogo variant="full" className="h-9 w-auto max-w-[180px]" />
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="flex flex-col gap-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={navigate}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/80 hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="border-t px-3 py-4">
          <Link
            href="/perfil"
            onClick={navigate}
            className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                {user ? getInitials(user.name) : 'LP'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.name ?? 'Usuário'}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </Link>

          <Link
            href="/configuracoes"
            onClick={navigate}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted"
          >
            <Settings className="h-5 w-5" />
            Configurações
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
