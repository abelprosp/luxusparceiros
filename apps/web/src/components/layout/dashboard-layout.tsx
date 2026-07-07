'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { MobileNavProvider } from '@/components/layout/mobile-nav-context';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  return (
    <ProtectedRoute>
      <MobileNavProvider>
        <div className="min-h-screen dashboard-surface">
          <Sidebar />
          <MobileNav />
          <div className="transition-all duration-300 lg:pl-[88px]">
            <Header title={title} description={description} />
            <main className="animate-fade-in px-4 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</main>
          </div>
        </div>
      </MobileNavProvider>
    </ProtectedRoute>
  );
}
