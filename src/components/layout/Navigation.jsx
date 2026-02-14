'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Home, MessageSquare, Users } from 'lucide-react';
import { profileThumb } from '@/lib/cloudinary';

export const Navigation = () => {
  const { currentUser, profile, logout } = useAuth();

  if (!currentUser || !profile) return null;

  return (
    <nav className="bg-yellow-400 p-4 border-b-4 border-gray-800">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/">
            <h1 className="text-4xl font-bold text-gray-800 tracking-wider cursor-pointer hover:opacity-80"
                style={{ fontFamily: 'monospace' }}>
              FREAK ON!
            </h1>
          </Link>

          <div className="flex gap-4">
            <Link href="/" className="flex items-center gap-2 px-4 py-2 hover:bg-yellow-300 rounded">
              <Home size={20} />
              Alkuun
            </Link>
            <Link href="/forum" className="flex items-center gap-2 px-4 py-2 hover:bg-yellow-300 rounded">
              <MessageSquare size={20} />
              Foorumi
            </Link>
            <Link href="/members" className="flex items-center gap-2 px-4 py-2 hover:bg-yellow-300 rounded">
              <Users size={20} />
              Jäsenet
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/profile"
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-yellow-400 rounded hover:bg-gray-700"
          >
            {profile.profile_image_url ? (
              <img src={profileThumb(profile.profile_image_url)} alt={profile.username} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <span className="text-2xl">{profile.avatar}</span>
            )}
            <span>{profile.username}</span>
          </Link>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Kirjaudu ulos
          </button>
        </div>
      </div>
    </nav>
  );
};