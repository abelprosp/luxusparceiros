'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { canAccessRoute } from '@/lib/rbac';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = canAccessRoute(user, pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (!allowed) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, allowed, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !allowed) return null;

  return <>{children}</>;
}
