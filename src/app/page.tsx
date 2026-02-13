'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { mockUsers } from '@/lib/mockData';
import Link from 'next/link';

export default function Home() {
  const { currentUser } = useAuth();

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4">
      <Card className="mb-8">
        <h2 className="text-3xl font-bold mb-4">Tervetuloa Freak On! -foorumille</h2>
        <p className="text-gray-700 text-lg mb-4">
          Suomalainen pelaajayhteisö vuodesta 2004. Keskustele peleistä, teknologiasta ja muusta mielenkiintoisesta!
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

      <Card>
        <h3 className="text-2xl font-bold mb-4">Aktiiviset jäsenet</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mockUsers.map(user => (
            <div key={user.id} className="border-2 border-gray-200 rounded-lg p-4 hover:border-yellow-400 transition">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{user.avatar}</span>
                <div>
                  <p className="font-bold text-lg">{user.username}</p>
                  <p className="text-sm text-gray-500">{user.posts} viestiä</p>
                </div>
              </div>
              <p className="text-xs text-gray-400">Liittynyt: {user.joinDate}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
