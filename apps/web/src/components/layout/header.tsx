'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { isAttendantUser, isPartnerUser } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { LuxusLogo } from '@/components/brand/luxus-logo';
import { NotificationsBell } from '@/components/notifications/notifications-bell';

interface HeaderProps {
  title?: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const isPartner = isPartnerUser(user);
  const isAttendant = isAttendantUser(user);
  const firstName = user?.name?.split(' ')[0] ?? 'usuário';

  const contextLabel = isAttendant
    ? [user?.branchName, user?.partnerName ? `Parceiro: ${user.partnerName}` : null].filter(Boolean).join(' · ')
    : isPartner && user?.partnerName
      ? `Parceiro: ${user.partnerName}`
      : null;

  const subtitle =
    description ??
    contextLabel ??
    'Explore informações e atividades do ecossistema Luxus Parceiros.';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex items-center gap-5">
        <LuxusLogo variant="full" className="hidden shrink-0 md:flex" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Olá, {firstName}!
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {title ? `${title} — ${subtitle}` : subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="h-11 w-11 rounded-2xl bg-card shadow-bento hover:bg-accent dark:bg-card"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Alternar tema</span>
        </Button>

        <div className="h-11 w-11">
          <NotificationsBell />
        </div>
      </div>
    </header>
  );
}
