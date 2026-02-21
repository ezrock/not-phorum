import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

let authStateChangeCallback: ((event: string, session: { user?: { id: string; email?: string | null } | null } | null) => void) | null = null;
const unsubscribeMock = vi.fn();
const getSessionMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const signUpMock = vi.fn();
const signOutMock = vi.fn();
const rpcMock = vi.fn();
const profileSingleMock = vi.fn();

vi.mock('@/lib/supabase/client', () => {
  return {
    createClient: () => ({
      auth: {
        getSession: getSessionMock,
        onAuthStateChange: vi.fn((callback: typeof authStateChangeCallback) => {
          authStateChangeCallback = callback;
          return { data: { subscription: { unsubscribe: unsubscribeMock } } };
        }),
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
        signOut: signOutMock,
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: profileSingleMock,
          })),
        })),
      })),
      rpc: rpcMock,
    }),
  };
});

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthProvider critical flows', () => {
  beforeEach(() => {
    authStateChangeCallback = null;
    unsubscribeMock.mockReset();
    getSessionMock.mockReset();
    signInWithPasswordMock.mockReset();
    signUpMock.mockReset();
    signOutMock.mockReset();
    rpcMock.mockReset();
    profileSingleMock.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  it('loads initial session and profile from getSession on mount', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-1', email: 'u1@example.com' },
        },
      },
    });
    profileSingleMock.mockResolvedValue({
      data: { id: 'user-1', username: 'tester' },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.currentUser?.id).toBe('user-1');
    expect((result.current.profile as { username?: string } | null)?.username).toBe('tester');
  });

  it('handles onAuthStateChange callback synchronously and updates state', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    profileSingleMock.mockResolvedValue({
      data: { id: 'user-2', username: 'second' },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(authStateChangeCallback).toBeTypeOf('function');

    let callbackReturn: unknown;
    act(() => {
      callbackReturn = authStateChangeCallback?.('SIGNED_IN', {
        user: { id: 'user-2', email: 'u2@example.com' },
      });
    });

    expect(callbackReturn).toBeUndefined();

    await waitFor(() => {
      expect(result.current.currentUser?.id).toBe('user-2');
    });

    await waitFor(() => {
      expect((result.current.profile as { username?: string } | null)?.username).toBe('second');
    });
  });

  it('login() and register() call expected auth APIs', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    profileSingleMock.mockResolvedValue({ data: { id: 'user-3', username: 'third' }, error: null });
    signInWithPasswordMock.mockResolvedValue({
      data: {
        user: { id: 'user-3', email: 'u3@example.com' },
        session: { access_token: 'token-1' },
      },
      error: null,
    });
    signUpMock.mockResolvedValue({ data: { user: { id: 'user-4' } }, error: null });
    rpcMock.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.login('u3@example.com', 'secret123');
    });

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'u3@example.com',
      password: 'secret123',
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/login-network', {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: 'Bearer token-1' },
    });

    await act(async () => {
      await result.current.register('u4@example.com', 'pw123456', 'newbie');
    });

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'u4@example.com',
      password: 'pw123456',
      options: { data: { username: 'newbie' } },
    });
  });
});
