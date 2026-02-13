'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // Full page navigation ensures auth cookies are sent to middleware
      window.location.href = '/forum';
    } catch (err: any) {
      setError(err.message || 'Kirjautuminen epäonnistui');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <Card>
        <h1 className="text-3xl font-bold mb-6">Kirjaudu sisään</h1>

        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Kirjaudutaan...' : 'Kirjaudu sisään'}
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
  );
}
