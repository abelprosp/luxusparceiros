'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { MobileNavProvider } from '@/components/layout/mobile-nav-context';
import { GlobalLoadingBar } from '@/components/ui/global-loading-bar';
import { cn } from '@/lib/utils';

const SIDEBAR_EXPANDED_KEY = 'luxus:sidebar-expanded';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  useEffect(() => {
    setSidebarExpanded(localStorage.getItem(SIDEBAR_EXPANDED_KEY) === 'true');
  }, []);

  const changeSidebar = (expanded: boolean) => {
    setSidebarExpanded(expanded);
    localStorage.setItem(SIDEBAR_EXPANDED_KEY, String(expanded));
  };

  return (
    <ProtectedRoute>
      <MobileNavProvider>
        <div className="min-h-screen dashboard-surface">
          <GlobalLoadingBar />
          <Sidebar expanded={sidebarExpanded} onExpandedChange={changeSidebar} />
          <MobileNav />
          <div
            className={cn(
              'transition-[padding] duration-300',
              sidebarExpanded ? 'lg:pl-[272px]' : 'lg:pl-[88px]',
            )}
          >
            <Header title={title} description={description} />
            <main className="animate-fade-in px-4 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</main>
          </div>
        </div>
      </MobileNavProvider>
    </ProtectedRoute>
  );
}
