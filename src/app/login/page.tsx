'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

export default function LoginPage() {
  const { currentUser, loading, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [checkingSettings, setCheckingSettings] = useState(true);

  // Logged-in users go straight to the forum
  useEffect(() => {
    if (!loading && currentUser) {
      // Intentionally full navigation (not router.push) for auth-boundary consistency.
      // See docs/architecture.md.
      window.location.href = '/';
    }
  }, [loading, currentUser]);

  useEffect(() => {
    const fetchRegistrationSetting = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'registration_enabled')
        .single();

      setRegistrationEnabled(data?.value === 'true');
      setCheckingSettings(false);
    };

    fetchRegistrationSetting();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoggingIn(true);

    try {
      await login(email, password);
      // Intentionally full navigation (not router.push) for auth-boundary consistency.
      // See docs/architecture.md.
      window.location.href = '/';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Kirjautuminen epäonnistui';
      setError(message);
      setLoggingIn(false);
    }
  };

  // Hide the login form once we know the user is logged in (redirect is in progress)
  if (!loading && currentUser) {
    return null;
  }

  return (
    <div className="layout-center-screen-offset-header">
      <div className="max-w-md w-full">
        <div className="mb-8 flex justify-center">
          <pre className="text-gray-800 leading-tight text-[0.45rem] sm:text-[0.55rem] md:text-xs overflow-hidden text-left">{
`___________                      __     ________
\\_   _____/______   ____ _____  |  | __ \\_____  \\   ____
 |    __) \\_  __ \\_/ __ \\\\__  \\ |  |/ /  /   |   \\ /    \\
 |     \\   |  | \/\\  ___/ / __ \\|    <  /    |    \\   |  \\
 \\___  /   |__|    \\___  >____  /__|_ \\ \\_______  /___|  /
     \/                \/     \/     \/         \/     \/
_______________  _______      _____
\\_____  \\   _  \\ \\   _  \\    /  |  |
 /  ____/  /_\\  \\/  /_\\  \\  /   |  |_  ______
/       \\  \\_/   \\  \\_/   \/    ^   / /_____/
\\_______ \\_____  /\\_____  /\\____   |
        \/     \/       \/      |__|`
        }
        </pre>
        </div>

        <Card>
          <h2 className="text-xl font-bold mb-4">Kirjaudu sisään</h2>

          {error && <Alert variant="error">{error}</Alert>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Sähköposti
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                required
                placeholder="esim@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Salasana
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              variant="success"
              disabled={loggingIn}
              className="w-full"
            >
              {loggingIn ? 'Kirjaudutaan...' : 'Kirjaudu sisään'}
            </Button>
          </form>

          {!checkingSettings && registrationEnabled && (
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Eikö sinulla ole tiliä?{' '}
                <Link href="/register" className="text-yellow-600 hover:underline font-semibold">
                  Rekisteröidy tästä
                </Link>
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
