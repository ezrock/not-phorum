'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';

interface ProfileRecord {
  id: string;
  username?: string;
  profile_image_url?: string | null;
  is_admin?: boolean;
  [key: string]: unknown;
}

interface AuthContextValue {
  currentUser: User | null;
  profile: ProfileRecord | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<unknown>;
  logout: () => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<unknown>;
  refreshProfile: () => Promise<void>;
  supabase: ReturnType<typeof createClient>;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState(() => createClient());

  // Fetch user profile
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data as ProfileRecord);
    }
  }, [supabase]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, supabase.auth]);

  const login = async (email: string, password: string): Promise<unknown> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Track login counters and refresh profile immediately so stats update without manual reload.
    if (data.user) {
      const accessToken = data.session?.access_token;
      const loginCountPromise = supabase.rpc('increment_login_count', { target_user_id: data.user.id });
      const networkPromise = fetch('/api/auth/login-network', {
        method: 'POST',
        credentials: 'include',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      const [loginCountRes, networkRes] = await Promise.allSettled([loginCountPromise, networkPromise]);

      if (loginCountRes.status === 'fulfilled' && loginCountRes.value.error) {
        console.warn('increment_login_count failed:', loginCountRes.value.error.message);
      }
      if (loginCountRes.status === 'rejected') {
        console.warn('increment_login_count request failed');
      }

      if (networkRes.status === 'fulfilled' && !networkRes.value.ok) {
        console.warn('login-network tracking failed:', networkRes.value.status);
      }
      if (networkRes.status === 'rejected') {
        console.warn('login-network request failed');
      }

      await fetchProfile(data.user.id);
    }

    return data;
  };

  const logout = async (): Promise<void> => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setProfile(null);
    // Full page navigation to ensure cookies are cleared for middleware
    window.location.href = '/';
  };

  const register = async (email: string, password: string, username: string): Promise<unknown> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });

    if (error) throw error;
    return data;
  };

  const refreshProfile = async (): Promise<void> => {
    if (currentUser) {
      await fetchProfile(currentUser.id);
    }
  };

  const value = {
    currentUser,
    profile,
    loading,
    login,
    logout,
    register,
    refreshProfile,
    supabase,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
