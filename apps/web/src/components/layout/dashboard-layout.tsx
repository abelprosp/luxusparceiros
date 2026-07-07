'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen dashboard-surface">
        <Sidebar />
        <div className={cn('transition-all duration-300', 'lg:pl-[88px]')}>
          <Header title={title} description={description} />
          <main className="animate-fade-in px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
