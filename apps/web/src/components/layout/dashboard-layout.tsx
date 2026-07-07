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
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className={cn('transition-all duration-300', 'lg:pl-64')}>
          <Header title={title} description={description} />
          <main className="p-6 animate-fade-in">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
