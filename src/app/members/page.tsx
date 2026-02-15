'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Users, Shield } from 'lucide-react';
import { profileThumb } from '@/lib/cloudinary';

interface Profile {
  id: string;
  username: string;
  avatar: string;
  profile_image_url: string | null;
  created_at: string;
  is_admin: boolean;
}

export default function MembersPage() {
  const { supabase, profile: myProfile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar, profile_image_url, created_at, is_admin')
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMembers(data);
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
      <Card className="mb-6">
        <div className="flex items-center gap-3">
          <Users size={28} className="text-gray-800" />
          <div>
            <h2 className="text-3xl font-bold">Jäsenet</h2>
            <p className="text-gray-600">
              Yhteensä {members.length} rekisteröitynyttä jäsentä
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {members.map((member) => (
          <Link key={member.id} href={`/profile/${member.id}`}>
            <Card className="py-3 px-4 hover:border-yellow-400 transition cursor-pointer">
              <div className="flex items-center gap-4">
                {member.profile_image_url ? (
                  <img src={profileThumb(member.profile_image_url)} alt={member.username} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <span className="text-3xl">{member.avatar}</span>
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
