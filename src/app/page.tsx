'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import Link from 'next/link';

export default function Home() {
  const { currentUser, loading, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Logged-in users go straight to the forum
  useEffect(() => {
    if (!loading && currentUser) {
      window.location.href = '/forum';
    }
  }, [loading, currentUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoggingIn(true);

    try {
      await login(email, password);
      window.location.href = '/forum';
    } catch (err: any) {
      setError(err.message || 'Kirjautuminen epäonnistui');
      setLoggingIn(false);
    }
  };

  // Hide the login form once we know the user is logged in (redirect is in progress)
  if (!loading && currentUser) {
    return null;
  }

  return (
    <div className="flex items-center justify-center px-4" style={{ minHeight: 'calc(100vh - 4rem)' }}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1
            className="text-6xl font-bold text-gray-800 tracking-wider mb-2"
            style={{ fontFamily: 'monospace' }}
          >
            FREAK ON!
          </h1>
          <p className="text-gray-600 text-lg">
            Vuodesta 2004
          </p>
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

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Eikö sinulla ole tiliä?{' '}
              <Link href="/register" className="text-yellow-600 hover:underline font-semibold">
                Rekisteröidy tästä
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
