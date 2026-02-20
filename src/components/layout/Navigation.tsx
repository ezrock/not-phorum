'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Shield, ScrollText, User } from 'lucide-react';
import { profileThumb } from '@/lib/cloudinary';
import { UI_ICON_SETTINGS } from '@/lib/uiSettings';
import { SearchInput } from '@/components/ui/SearchInput';
import type { FormEvent, JSX } from 'react';

export const Navigation = (): JSX.Element | null => {
  const { currentUser, profile, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const showNavLinkIcons = UI_ICON_SETTINGS.showNavigationLinkIcons;

  if (!currentUser || !profile) return null;

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 2) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      setSearchQuery('');
    }
  };

  return (
    <nav className="app-header app-nav p-4 border-b-1 border-gray-200">
      <div className="app-header-inner app-nav-inner flex items-center gap-4">
        <div className="app-nav-left flex items-center gap-8 flex-shrink-0">
          <Link href="/" className="app-nav-logo hover:opacity-80" aria-label="Freak On home">
            <picture>
              <source media="(max-width: 480px)" srcSet="/logo32-sm.gif" />
              <img src="/logo32.gif" alt="Freak On logo" className="app-nav-logo-image" />
            </picture>
          </Link>

          <div className="app-nav-links flex gap-2">
            <Link href="/members" className="flex items-center gap-2 px-4 py-2 max-h-10 hover:bg-yellow-300 rounded">
              {showNavLinkIcons && <Users size={20} />}
              Membut
            </Link>
            <Link href="/loki" className="flex items-center gap-2 px-4 py-2 max-h-10 hover:bg-yellow-300 rounded">
              {showNavLinkIcons && <ScrollText size={20} />}
              Loki
            </Link>
            {profile?.is_admin && (
              <Link href="/admin" className="flex items-center gap-2 px-4 py-2 max-h-10 hover:bg-yellow-300 rounded">
                {showNavLinkIcons && <Shield size={20} />}
                Admin
              </Link>
            )}
          </div>
        </div>

        <div className="app-nav-right flex items-center gap-2 flex-1 min-w-0 ml-4">
          <form onSubmit={handleSearch} className="app-nav-search flex-1 min-w-0">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hae..."
              inputClassName="w-full"
            />
          </form>
          <Link
            href="/profile"
            className="flex items-center gap-2 px-4 py-2 max-h-10 bg-transparent text-gray-800 rounded hover:bg-yellow-300 flex-shrink-0"
          >
            {showNavLinkIcons && (
              profile.profile_image_url ? (
                <img src={profileThumb(profile.profile_image_url)} alt={profile.username} className="avatar-inline-sm" />
              ) : (
                <span className="avatar-inline-sm-fallback">
                  <User size={12} />
                </span>
              )
            )}
            <span className="bp-hide-sm">{profile.username}</span>
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-md text-gray-600 rounded hover:bg-red-700 hover:text-white transition flex-shrink-0"
          >
            Ulos
          </button>
        </div>
      </div>
    </nav>
  );
};
