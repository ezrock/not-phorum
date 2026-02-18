'use client';

import { useEffect, useMemo, useState } from 'react';
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
const NOTIFICATION_REPEAT_COUNT = 8;

export function AppShell({ children }: AppShellProps) {
  const { currentUser, loading, supabase } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const isPublicPath = PUBLIC_PATHS.has(pathname);
  const isAuthPath = AUTH_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
  const shouldRedirectLoggedIn = !loading && !!currentUser && !isAuthPath;
  const shouldRedirectLoggedOut = !loading && !currentUser && !isPublicPath;
  const showNotification = useMemo(
    () => !!currentUser && notificationEnabled && notificationMessage.trim().length > 0,
    [currentUser, notificationEnabled, notificationMessage]
  );
  const notificationLoopText = useMemo(
    () => `${notificationMessage}${' '.repeat(24)}`,
    [notificationMessage]
  );
  const notificationStrip = useMemo(
    () => notificationLoopText.repeat(NOTIFICATION_REPEAT_COUNT),
    [notificationLoopText]
  );

  useEffect(() => {
    if (shouldRedirectLoggedIn) {
      router.replace('/forum');
    }
    if (shouldRedirectLoggedOut) {
      router.replace('/login');
    }
  }, [shouldRedirectLoggedIn, shouldRedirectLoggedOut, router]);

  useEffect(() => {
    if (!currentUser) return;

    const fetchNotificationSettings = async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['notification_enabled', 'notification_message']);

      if (!data) return;

      const map = new Map<string, string>();
      for (const row of data as { key: string; value: string }[]) {
        map.set(row.key, row.value);
      }

      setNotificationEnabled(map.get('notification_enabled') === 'true');
      setNotificationMessage(map.get('notification_message') || '');
    };

    fetchNotificationSettings();
  }, [currentUser, supabase]);

  // Prevent page flashes while redirecting.
  if (loading || shouldRedirectLoggedIn || shouldRedirectLoggedOut) return null;

  if (!currentUser) {
    return <main className="min-h-screen app-content pb-8">{children}</main>;
  }

  return (
    <div className="min-h-screen app-content flex flex-col">
      {showNotification && (
        <div className="h-5 bg-black overflow-hidden border-b border-gray-900">
          <div className="notification-marquee whitespace-nowrap text-[12px] leading-5 text-green-400 px-2" style={{ fontFamily: 'monospace' }}>
            <span className="notification-marquee-content">{notificationStrip}</span>
            <span className="notification-marquee-content" aria-hidden="true">{notificationStrip}</span>
          </div>
        </div>
      )}
      <Navigation />
      <main className="flex-1 pb-8">{children}</main>
      <Footer />
    </div>
  );
}
