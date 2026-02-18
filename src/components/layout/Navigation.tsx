'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Search, Shield, ScrollText, User } from 'lucide-react';
import { profileThumb } from '@/lib/cloudinary';
import type { FormEvent, JSX } from 'react';

export const Navigation = (): JSX.Element | null => {
  const { currentUser, profile, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  if (!currentUser || !profile) return null;

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 2) {
      router.push(`/forum/search?q=${encodeURIComponent(trimmed)}`);
      setSearchQuery('');
    }
  };

  return (
    <nav className="app-header p-4 border-b-4 border-gray-800">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/forum" className="hover:opacity-80" aria-label="Freak On home">
            <Image src="/logo32.gif" alt="Freak On logo" width={207} height={24} priority />
          </Link>

          <div className="flex gap-2">
            <Link href="/members" className="flex items-center gap-2 px-4 py-2 max-h-10 hover:bg-yellow-300 rounded">
              <Users size={20} />
              Membut
            </Link>
            <Link href="/loki" className="flex items-center gap-2 px-4 py-2 max-h-10 hover:bg-yellow-300 rounded">
              <ScrollText size={20} />
              Loki
            </Link>
            {profile?.is_admin && (
              <Link href="/admin" className="flex items-center gap-2 px-4 py-2 max-h-10 hover:bg-yellow-300 rounded">
                <Shield size={20} />
                Admin
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hae..."
              className="pl-9 pr-3 py-1.5 max-h-10 rounded border-2 border-grey-800 bg-white placeholder-gray-600 text-gray-800 text-md focus:outline-none focus:border-gray-800 focus:bg-white w-36 transition-all focus:w-56"
            />
          </form>
          <Link
            href="/profile"
            className="flex items-center gap-2 px-4 py-2 max-h-10 bg-transparent text-gray-800 rounded hover:bg-yellow-300"
          >
            {profile.profile_image_url ? (
              <img src={profileThumb(profile.profile_image_url)} alt={profile.username} className="w-6 h-6 rounded-none object-cover" />
            ) : (
              <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 inline-flex items-center justify-center">
                <User size={14} />
              </span>
            )}
            <span>{profile.username}</span>
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-md text-gray-600 rounded hover:bg-red-700 hover:text-white transition"
          >
            Ulos
          </button>
        </div>
      </div>
    </nav>
  );
};
