'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Users, Shield, User } from 'lucide-react';
import { profileThumb } from '@/lib/cloudinary';
import { trophyLocalIconUrl } from '@/lib/trophies';

interface Profile {
  id: string;
  username: string;
  profile_image_url: string | null;
  created_at: string;
  is_admin: boolean;
}

interface Trophy {
  id: number;
  code: string;
  name: string;
  points: number;
  icon_path: string | null;
}

interface ProfileTrophyRow {
  profile_id: string;
  trophy: Trophy | Trophy[] | null;
}

export default function MembersPage() {
  const { supabase, profile: myProfile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [memberTrophies, setMemberTrophies] = useState<Record<string, Trophy[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      const [membersRes, trophiesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, profile_image_url, created_at, is_admin')
          .order('created_at', { ascending: true }),
        supabase
          .from('profile_trophies')
          .select('profile_id, trophy:trophies(id, code, name, points, icon_path)'),
      ]);

      if (!membersRes.error && membersRes.data) {
        setMembers(membersRes.data);
      }

      if (!trophiesRes.error && trophiesRes.data) {
        const grouped: Record<string, Trophy[]> = {};

        for (const row of trophiesRes.data as ProfileTrophyRow[]) {
          const parsedTrophy = Array.isArray(row.trophy) ? row.trophy[0] : row.trophy;
          if (!parsedTrophy) continue;

          if (!grouped[row.profile_id]) {
            grouped[row.profile_id] = [];
          }
          grouped[row.profile_id].push(parsedTrophy);
        }

        for (const profileId of Object.keys(grouped)) {
          grouped[profileId].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
        }

        setMemberTrophies(grouped);
      }
      setLoading(false);
    };

    fetchMembers();
  }, [supabase]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fi-FI', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto mt-8 px-4">
        <Card>
          <p className="text-center text-gray-500 py-8">Ladataan jäseniä...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Users size={28} className="text-gray-800" />
        <div>
          <h2 className="text-3xl font-bold">Membut</h2>
          <p className="text-gray-600">
            Yhteensä {members.length} membulia.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {members.map((member) => (
          <Link key={member.id} href={`/profile/${member.id}`}>
            <Card className="py-3 px-4 hover:border-yellow-400 transition cursor-pointer">
              <div className="flex items-start gap-4">
                {member.profile_image_url ? (
                  <img src={profileThumb(member.profile_image_url)} alt={member.username} className="w-10 h-10 rounded-none object-cover" />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-gray-200 text-gray-500 inline-flex items-center justify-center">
                    <User size={20} />
                  </span>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    {member.username}
                    {myProfile?.is_admin && member.is_admin && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-200 px-1.5 py-0.5 rounded">
                        <Shield size={10} />
                        Admin
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Liittynyt {formatDate(member.created_at)}
                  </p>

                  {memberTrophies[member.id]?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {memberTrophies[member.id].map((trophy) => (
                        <span
                          key={`${member.id}-${trophy.id}`}
                          className="inline-flex items-center rounded bg-yellow-100 text-yellow-800 px-1.5 py-0.5 text-[11px] font-medium"
                          title={`${trophy.name} (${trophy.points} p)`}
                        >
                          {trophyLocalIconUrl(trophy.icon_path) ? (
                            <img
                              src={trophyLocalIconUrl(trophy.icon_path) as string}
                              alt={trophy.name}
                              className="w-4 h-5 object-contain"
                            />
                          ) : (
                            <span>{trophy.name}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-gray-400">Ei kunniamerkkejä (vielä)</p>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        ))}

        {members.length === 0 && (
          <Card>
            <p className="text-center text-gray-500 py-8">
              Ei vielä jäseniä.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
