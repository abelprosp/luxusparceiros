'use client';

import { Bell, LogOut, Moon, Sun, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isPartnerUser } from '@/lib/rbac';
import { getInitials } from '@luxus/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  title?: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const isPartner = isPartnerUser(user);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-md">
      <div>
        {title && <h1 className="text-xl font-semibold tracking-tight">{title}</h1>}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded-full"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Alternar tema</span>
        </Button>

        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -right-0.5 -top-0.5 h-5 w-5 rounded-full p-0 text-[10px]">
            3
          </Badge>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback>
                  {user ? getInitials(user.name) : 'LP'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(isPartner ? '/perfil' : '/dashboard')}>
              <User className="mr-2 h-4 w-4" />
              Meu perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
