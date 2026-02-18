'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Users, Shield, User } from 'lucide-react';
import { profileThumb } from '@/lib/cloudinary';
import { trophyLocalIconUrl, parseTrophies } from '@/lib/trophies';
import type { Trophy, TrophyJoinRow } from '@/lib/trophies';
import { formatFinnishDate } from '@/lib/formatDate';

interface Profile {
  id: string;
  username: string;
  profile_image_url: string | null;
  created_at: string;
  is_admin: boolean;
}

interface MemberTrophyRow extends TrophyJoinRow {
  profile_id: string;
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

        for (const row of trophiesRes.data as MemberTrophyRow[]) {
          const trophyList = parseTrophies([row]);
          if (trophyList.length === 0) continue;

          if (!grouped[row.profile_id]) {
            grouped[row.profile_id] = [];
          }
          grouped[row.profile_id].push(...trophyList);
        }

        // parseTrophies already sorts, but re-sort grouped arrays for consistency
        for (const profileId of Object.keys(grouped)) {
          grouped[profileId].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
        }

        setMemberTrophies(grouped);
      }
      setLoading(false);
    };

    fetchMembers();
  }, [supabase]);

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
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Users size={28} className="text-gray-800" />
          <h2 className="text-3xl font-bold">Membut</h2>
        </div>
        <p className="text-gray-600 mt-1">
          Yhteensä {members.length} membulia.
        </p>
      </div>

      <div className="space-y-2">
        {members.map((member) => (
          <Link key={member.id} href={`/profile/${member.id}`}>
            <Card className="hover:border-yellow-400 transition cursor-pointer">
              <div className="flex items-start gap-4">
                {member.profile_image_url ? (
                  <img src={profileThumb(member.profile_image_url)} alt={member.username} className="avatar-large" />
                ) : (
                  <span className="avatar-large-fallback">
                    <User size={30} />
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
                    Liittynyt {formatFinnishDate(member.created_at)}
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
