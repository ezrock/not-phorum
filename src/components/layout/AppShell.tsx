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
const AUTH_ROOTS = ['/forum', '/members', '/profile', '/admin', '/loki'];

export function AppShell({ children }: AppShellProps) {
  const { currentUser, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPath = PUBLIC_PATHS.has(pathname);
  const isAuthPath = AUTH_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
  const shouldRedirectLoggedIn = !loading && !!currentUser && !isAuthPath;
  const shouldRedirectLoggedOut = !loading && !currentUser && !isPublicPath;

  useEffect(() => {
    if (shouldRedirectLoggedIn) {
      router.replace('/forum');
    }
    if (shouldRedirectLoggedOut) {
      router.replace('/login');
    }
  }, [shouldRedirectLoggedIn, shouldRedirectLoggedOut, router]);

  // Prevent page flashes while redirecting.
  if (loading || shouldRedirectLoggedIn || shouldRedirectLoggedOut) return null;

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
