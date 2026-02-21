'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Shield, User } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
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

interface InactiveMember {
  id: string;
  username: string;
  profile_image_url: string | null;
  created_at: string;
  is_admin: boolean;
  last_activity_at: string | null;
}

interface RawMemberTrophyRow extends TrophyJoinRow {
  profile_id: string;
}

function MemberCard({
  member,
  canSeeAdminBadge,
  trophies,
}: {
  member: Profile;
  canSeeAdminBadge: boolean;
  trophies: Trophy[];
}) {
  return (
    <Link href={`/profile/${member.id}`}>
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
              {canSeeAdminBadge && member.is_admin && (
                <span className="admin-badge px-1.5">
                  <Shield size={10} />
                  Admin
                </span>
              )}
            </h3>
            <p className="text-muted-xs">
              Liittynyt {formatFinnishDate(member.created_at)}
            </p>

            {trophies.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {trophies.map((trophy) => {
                  const iconUrl = trophyLocalIconUrl(trophy.icon_path);
                  return (
                    <span
                      key={`${member.id}-${trophy.id}`}
                      className="inline-flex items-center rounded bg-yellow-100 text-yellow-800 px-1.5 py-0.5 text-[11px] font-medium"
                      title={`${trophy.name} (${trophy.points} p)`}
                    >
                      {iconUrl ? (
                        <img
                          src={iconUrl}
                          alt={trophy.name}
                          className="w-4 h-5 object-contain"
                        />
                      ) : (
                        <span>{trophy.name}</span>
                      )}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-gray-400">Ei kunniamerkkejä (vielä)</p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function InactiveMembersCard({ inactiveMembers }: { inactiveMembers: InactiveMember[] }) {
  if (inactiveMembers.length === 0) {
    return null;
  }

  return (
    <Card>
      <h3 className="card-title mb-2">Missä he ovat nyt?</h3>
      <p className="text-muted-sm mb-3">
        365 päivää hiljaisuutta: {inactiveMembers.length}
      </p>

      <div className="space-y-2">
        {inactiveMembers.map((member) => (
          <Link key={`inactive-${member.id}`} href={`/profile/${member.id}`} className="list-row-card hover:border-yellow-400 transition">
            <span className="font-medium truncate">{member.username}</span>
            <span className="text-muted-xs whitespace-nowrap">
              {member.last_activity_at
                ? `Viimeksi aktiivinen ${formatFinnishDate(member.last_activity_at)}`
                : `Ei aktiviteettia (liittynyt ${formatFinnishDate(member.created_at)})`}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default function MembersPage() {
  const { supabase, profile: myProfile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [inactiveMembers, setInactiveMembers] = useState<InactiveMember[]>([]);
  const [memberTrophies, setMemberTrophies] = useState<Record<string, Trophy[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      const [membersRes, inactiveRes, trophiesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, profile_image_url, created_at, is_admin')
          .eq('approval_status', 'approved')
          .order('created_at', { ascending: true }),
        supabase
          .rpc('get_inactive_members_since', { input_days: 365 }),
        supabase
          .from('profile_trophies')
          .select('profile_id, trophy:trophies(id, code, name, points, icon_path)'),
      ]);

      if (!membersRes.error && membersRes.data) {
        setMembers(membersRes.data);
      }

      if (!inactiveRes.error && inactiveRes.data) {
        setInactiveMembers(inactiveRes.data as InactiveMember[]);
      }

      if (!trophiesRes.error && trophiesRes.data) {
        const grouped: Record<string, Trophy[]> = {};

        for (const row of trophiesRes.data as RawMemberTrophyRow[]) {
          const trophyList = parseTrophies([row]);
          if (trophyList.length === 0) continue;

          if (!grouped[row.profile_id]) {
            grouped[row.profile_id] = [];
          }
          grouped[row.profile_id].push(...trophyList);
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

  if (loading) {
    return (
      <div className="layout-page-shell">
        <Card>
          <p className="state-empty-text">Ladataan jäseniä...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="layout-page-shell">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Users size={28} className="text-gray-800" />
          <h2 className="text-3xl font-bold">Membut</h2>
        </div>
        <p className="text-gray-600 mt-1">
          Yhteensä {members.length} membulia.
        </p>
      </div>

      <div className="space-y-2 mb-4">
        {members.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            canSeeAdminBadge={Boolean(myProfile?.is_admin)}
            trophies={memberTrophies[member.id] || []}
          />
        ))}

        {members.length === 0 && (
          <Card>
            <p className="state-empty-text">
              Ei vielä jäseniä.
            </p>
          </Card>
        )}
      </div>

      <InactiveMembersCard inactiveMembers={inactiveMembers} />
    </div>
  );
}
