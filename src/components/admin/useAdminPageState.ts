import { useEffect, useState } from 'react';
import type { PendingUser } from '@/components/admin/types';
import { createClient } from '@/lib/supabase/client';

const SITE_SETTINGS_UPDATED_EVENT = 'site-settings-updated';

export interface TrophyOverview {
  id: number;
  code: string;
  name: string;
  points: number;
  icon_path: string | null;
  source: string;
  awarded_count: number;
}

export function useAdminPageState(supabase: ReturnType<typeof createClient>) {
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationToggling, setNotificationToggling] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [savingNotificationMessage, setSavingNotificationMessage] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [trophyLoading, setTrophyLoading] = useState(true);
  const [pendingUsersLoading, setPendingUsersLoading] = useState(true);
  const [trophyOverview, setTrophyOverview] = useState<TrophyOverview[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [totalAwardedTrophies, setTotalAwardedTrophies] = useState(0);

  useEffect(() => {
    const fetchAdminData = async () => {
      const [settingsRes, overviewRes, awardedRes] = await Promise.all([
        supabase
          .from('site_settings')
          .select('key, value')
          .in('key', ['registration_enabled', 'notification_enabled', 'notification_message']),
        supabase
          .from('admin_trophy_overview')
          .select('id, code, name, points, icon_path, source, awarded_count')
          .order('points', { ascending: false })
          .order('name', { ascending: true }),
        supabase
          .from('profile_trophies')
          .select('*', { count: 'exact', head: true }),
      ]);
      const pendingRes = await supabase
        .from('profiles')
        .select('id, username, created_at')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: true });

      if (settingsRes.data) {
        const settings = settingsRes.data as { key: string; value: string }[];
        const map = new Map(settings.map((row) => [row.key, row.value]));
        setRegistrationEnabled(map.get('registration_enabled') === 'true');
        setNotificationEnabled(map.get('notification_enabled') === 'true');
        setNotificationMessage(map.get('notification_message') || '');
      }
      if (overviewRes.data) {
        setTrophyOverview(overviewRes.data as TrophyOverview[]);
      }
      if (!pendingRes.error && pendingRes.data) {
        setPendingUsers(pendingRes.data as PendingUser[]);
      }
      setTotalAwardedTrophies(awardedRes.count || 0);

      setSettingsLoading(false);
      setTrophyLoading(false);
      setPendingUsersLoading(false);
    };

    fetchAdminData();
  }, [supabase]);

  const handleToggleRegistration = async () => {
    setToggling(true);
    const newValue = !registrationEnabled;

    const { error } = await supabase.rpc('update_site_setting', {
      setting_key: 'registration_enabled',
      setting_value: String(newValue),
    });

    if (!error) {
      setRegistrationEnabled(newValue);
      window.dispatchEvent(new Event(SITE_SETTINGS_UPDATED_EVENT));
    }
    setToggling(false);
  };

  const handleToggleNotification = async () => {
    setNotificationToggling(true);
    const newValue = !notificationEnabled;

    const { error } = await supabase.rpc('update_site_setting', {
      setting_key: 'notification_enabled',
      setting_value: String(newValue),
    });

    if (!error) {
      setNotificationEnabled(newValue);
      window.dispatchEvent(new Event(SITE_SETTINGS_UPDATED_EVENT));
    }

    setNotificationToggling(false);
  };

  const handleSaveNotificationMessage = async () => {
    setSavingNotificationMessage(true);

    await supabase.rpc('update_site_setting', {
      setting_key: 'notification_message',
      setting_value: notificationMessage.trim(),
    });

    window.dispatchEvent(new Event(SITE_SETTINGS_UPDATED_EVENT));
    setSavingNotificationMessage(false);
  };

  const refreshPendingUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, created_at')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true });

    setPendingUsers((data ?? []) as PendingUser[]);
  };

  const handleSetApprovalStatus = async (userId: string, status: 'approved' | 'rejected') => {
    setProcessingUserId(userId);
    const { error } = await supabase.rpc('set_profile_approval_status', {
      target_user_id: userId,
      new_status: status,
    });

    if (!error) {
      await refreshPendingUsers();
    }
    setProcessingUserId(null);
  };

  const loading = settingsLoading || trophyLoading || pendingUsersLoading;

  return {
    registrationEnabled,
    toggling,
    notificationEnabled,
    notificationToggling,
    notificationMessage,
    setNotificationMessage,
    savingNotificationMessage,
    trophyOverview,
    pendingUsers,
    processingUserId,
    totalAwardedTrophies,
    loading,
    handleToggleRegistration,
    handleToggleNotification,
    handleSaveNotificationMessage,
    handleSetApprovalStatus,
  };
}
