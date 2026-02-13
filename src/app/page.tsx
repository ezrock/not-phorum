'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
  const { currentUser } = useAuth();

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4">
      <Card className="mb-8">
        <h2 className="text-3xl font-bold mb-4">Freak On!e</h2>
        <p className="text-gray-700 text-lg mb-4">
          Vuodesta 2004.
        </p>
        {!currentUser && (
          <div className="flex gap-4">
            <Link href="/register">
              <Button variant="success" onClick={() => {}}>Liity yhteisöön</Button>
            </Link>
            <Link href="/login">
              <Button onClick={() => {}}>Kirjaudu sisään</Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
