'use client';

import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { isAttendantUser, isPartnerUser } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { LuxusLogo } from '@/components/brand/luxus-logo';
import { NotificationsBell } from '@/components/notifications/notifications-bell';
import { useMobileNav } from '@/components/layout/mobile-nav-context';

interface HeaderProps {
  title?: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { setOpen } = useMobileNav();
  const isPartner = isPartnerUser(user);
  const isAttendant = isAttendantUser(user);
  const firstName = user?.name?.split(' ')[0] ?? 'usuário';

  const contextLabel = isAttendant
    ? [user?.branchName, user?.partnerName ? `Parceiro: ${user.partnerName}` : null]
        .filter(Boolean)
        .join(' · ')
    : isPartner && user?.partnerName
      ? `Parceiro: ${user.partnerName}`
      : null;

  const subtitle =
    description ??
    contextLabel ??
    'Explore informações e atividades do ecossistema Luxus Parceiros.';

  const fullSubtitle = title ? `${title} — ${subtitle}` : subtitle;

  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menu</span>
          </Button>

          <LuxusLogo variant="full" className="hidden h-8 w-auto max-w-[140px] shrink-0 sm:block lg:hidden" />

          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
              Olá, {firstName}!
            </h1>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm lg:line-clamp-1">
              {fullSubtitle}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-10 w-10 rounded-2xl bg-card shadow-bento hover:bg-accent dark:bg-card sm:h-11 sm:w-11"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Alternar tema</span>
          </Button>

          <div className="h-10 w-10 sm:h-11 sm:w-11">
            <NotificationsBell />
          </div>
        </div>
      </div>
    </header>
  );
}
