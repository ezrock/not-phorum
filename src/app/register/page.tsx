'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { getFirstValidationError, rules, validate } from '@/lib/validation';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [checkingSettings, setCheckingSettings] = useState(true);
  const { register } = useAuth();

  useEffect(() => {
    const checkRegistration = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'registration_enabled')
        .single();

      if (data) {
        setRegistrationEnabled(data.value === 'true');
      }
      setCheckingSettings(false);
    };

    checkRegistration();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validation = validate(
      { username, password, confirmPassword },
      {
        username: [
          rules.minLength(3, 'Käyttäjätunnuksen tulee olla vähintään 3 merkkiä'),
        ],
        password: [
          rules.minLength(8, 'Salasanan tulee olla vähintään 8 merkkiä'),
          rules.custom(
            (value: unknown) => {
              const v = typeof value === 'string' ? value : '';
              return /[A-Z]/.test(v) && /[a-z]/.test(v) && /[0-9]/.test(v);
            },
            'Salasanassa tulee olla isoja ja pieniä kirjaimia sekä numeroita'
          ),
        ],
        confirmPassword: [
          rules.equalsField('password', 'Salasanat eivät täsmää'),
        ],
      }
    );
    const firstError = getFirstValidationError(validation);
    if (firstError) {
      setError(firstError);
      return;
    }

    setLoading(true);

    try {
      await register(email, password, username);
      window.location.href = '/forum';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Rekisteröityminen epäonnistui';
      setError(message);
      setLoading(false);
    }
  };

  if (checkingSettings) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <Card>
          <p className="text-center text-gray-500 py-8">Ladataan...</p>
        </Card>
      </div>
    );
  }

  if (!registrationEnabled) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <Card>
          <h1 className="text-3xl font-bold mb-4">Rekisteröityminen suljettu</h1>
          <p className="text-gray-600">Uusien käyttäjien rekisteröityminen on tällä hetkellä suljettu.</p>
          <div className="mt-6 text-center">
            <Link href="/" className="text-yellow-600 hover:underline font-semibold">
              Takaisin etusivulle
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <Card>
        <h1 className="text-3xl font-bold mb-6">Rekisteröidy</h1>

        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-1">
              Käyttäjätunnus
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              placeholder="käyttäjätunnus"
            />
          </div>

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
              minLength={8}
              placeholder="Vähintään 8 merkkiä, isoja/pieniä kirjaimia ja numeroita"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
              Vahvista salasana
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            variant="success"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Rekisteröidään...' : 'Rekisteröidy'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Onko sinulla jo tili?{' '}
            <Link href="/login" className="text-yellow-600 hover:underline font-semibold">
              Kirjaudu sisään
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
