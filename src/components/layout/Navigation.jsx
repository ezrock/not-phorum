'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Users, Search } from 'lucide-react';
import { profileThumb } from '@/lib/cloudinary';

export const Navigation = () => {
  const { currentUser, profile, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  if (!currentUser || !profile) return null;

  const handleSearch = (e) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 2) {
      router.push(`/forum/search?q=${encodeURIComponent(trimmed)}`);
      setSearchQuery('');
    }
  };

  return (
    <nav className="bg-yellow-400 p-4 border-b-4 border-gray-800">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/forum">
            <h1 className="text-4xl font-bold text-gray-800 tracking-wider cursor-pointer hover:opacity-80"
                style={{ fontFamily: 'monospace' }}>
              FREAK ON!
            </h1>
          </Link>

          <div className="flex gap-4">
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

        <form onSubmit={handleSearch} className="flex items-center">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hae..."
              className="pl-9 pr-3 py-1.5 rounded border-2 border-yellow-500 bg-yellow-300 placeholder-gray-600 text-gray-800 text-sm focus:outline-none focus:border-gray-800 focus:bg-white w-36 transition-all focus:w-56"
            />
          </div>
        </form>

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