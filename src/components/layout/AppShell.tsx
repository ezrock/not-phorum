'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
}

const PUBLIC_PATHS = new Set(['/login', '/register']);

export function AppShell({ children }: AppShellProps) {
  const { currentUser, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (loading) return;
    if (!currentUser && !isPublicPath) {
      router.replace('/login');
    }
  }, [loading, currentUser, isPublicPath, router]);

  // Prevent rendering app skeleton to logged-out users on protected routes.
  if (loading) return null;
  if (!currentUser && !isPublicPath) return null;

  if (!currentUser) {
    return <main className="min-h-screen bg-gray-100 pb-8">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navigation />
      <main className="flex-1 pb-8">{children}</main>
      <Footer />
    </div>
  );
}
