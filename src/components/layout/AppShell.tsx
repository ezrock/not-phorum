'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { RetroFilter } from '@/components/effects/RetroFilter';
import { getPreferredEventForDate } from '@/lib/siteEvents';
import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
}

const PUBLIC_PATHS = new Set(['/login', '/register']);
const AUTH_ROOTS = ['/forum', '/members', '/profile', '/admin', '/loki'];
const NOTIFICATION_REPEAT_COUNT = 8;
const SITE_SETTINGS_UPDATED_EVENT = 'site-settings-updated';

interface EventAudioRow {
  id: number;
  event_date: string;
  date_range_enabled: boolean;
  range_start_date: string | null;
  range_end_date: string | null;
  music_enabled: boolean;
  music_file: string | null;
}

export function AppShell({ children }: AppShellProps) {
  const { currentUser, profile, loading, supabase } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [events, setEvents] = useState<EventAudioRow[]>([]);
  const [targetDate, setTargetDate] = useState(() => new Date());
  const midiControllerRef = useRef<{ playUrl: (url: string) => Promise<void>; stop: () => void } | null>(null);
  const retroEnabled = (profile as { retro_enabled?: boolean } | null)?.retro_enabled === true;
  const midiEnabled = (profile as { midi_enabled?: boolean } | null)?.midi_enabled === true;
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
  const activeEvent = useMemo(
    () => getPreferredEventForDate(events, targetDate),
    [events, targetDate]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      setTargetDate((prev) => (
        prev.getFullYear() === now.getFullYear()
        && prev.getMonth() === now.getMonth()
        && prev.getDate() === now.getDate()
      ) ? prev : now);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (shouldRedirectLoggedIn) {
      router.replace('/forum');
    }
    if (shouldRedirectLoggedOut) {
      router.replace('/login');
    }
  }, [shouldRedirectLoggedIn, shouldRedirectLoggedOut, router]);

  useEffect(() => {
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

    const handleSiteSettingsUpdated = () => {
      fetchNotificationSettings();
    };

    window.addEventListener(SITE_SETTINGS_UPDATED_EVENT, handleSiteSettingsUpdated);

    return () => {
      window.removeEventListener(SITE_SETTINGS_UPDATED_EVENT, handleSiteSettingsUpdated);
    };
  }, [supabase]);

  useEffect(() => {
    if (!currentUser) return;

    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('site_events')
        .select('id, event_date, date_range_enabled, range_start_date, range_end_date, music_enabled, music_file');

      if (error || !data) {
        setEvents([]);
        return;
      }

      setEvents(data as EventAudioRow[]);
    };

    fetchEvents();
  }, [currentUser, supabase]);

  useEffect(() => {
    let cancelled = false;
    if (!currentUser || !midiEnabled || !activeEvent?.music_enabled || !activeEvent.music_file) {
      midiControllerRef.current?.stop();
      return;
    }

    const midiUrl = `/midi/${encodeURIComponent(activeEvent.music_file)}`;

    const playMidi = async () => {
      try {
        if (!midiControllerRef.current) {
          const midiModule = await import('@/app/midi/midi.js');
          if (cancelled) return;
          midiControllerRef.current = new midiModule.MidiBackgroundController({ volume: 0.35 });
        }
        await midiControllerRef.current.playUrl(midiUrl);
      } catch {
        // Keep silent in UI if parsing/playback fails.
      }
    };

    playMidi();

    return () => {
      cancelled = true;
    };
  }, [currentUser, midiEnabled, activeEvent]);

  useEffect(() => {
    return () => {
      midiControllerRef.current?.stop();
      midiControllerRef.current = null;
    };
  }, []);

  // Prevent page flashes while redirecting.
  if (loading || shouldRedirectLoggedIn || shouldRedirectLoggedOut) return null;

  if (!currentUser) {
    return (
      <>
        <RetroFilter enabled={retroEnabled} />
        <main className="min-h-screen app-content pb-8">{children}</main>
      </>
    );
  }

  return (
    <div className="min-h-screen app-content flex flex-col">
      <RetroFilter enabled={retroEnabled} />
      {showNotification && (
        <div className="h-5 bg-black overflow-hidden border-b border-gray-900">
          <div className="notification-marquee whitespace-nowrap text-[12px] leading-5 text-green-400 px-2 font-mono">
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
