'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { MessageSquare, Eye, Plus } from 'lucide-react';

interface Topic {
  id: number;
  title: string;
  views: number;
  created_at: string;
  category: { name: string; icon: string } | null;
  author: { username: string } | null;
}

export default function ForumPage() {
  const { supabase } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopics = async () => {
      const { data, error } = await supabase
        .from('topics')
        .select(`
          id, title, views, created_at,
          category:categories(name, icon),
          author:profiles!author_id(username)
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTopics(data as Topic[]);
      }
      setLoading(false);
    };

    fetchTopics();
  }, [supabase]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min sitten`;
    if (diffHours < 24) return `${diffHours}h sitten`;
    return `${diffDays} päivää sitten`;
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto mt-8 px-4">
        <Card>
          <p className="text-center text-gray-500 py-8">Ladataan...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4">
      <Card className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">Foorumi</h2>
            <p className="text-gray-600">
              Tervetuloa keskustelemaan! Kaikki aiheet yhdessä näkymässä.
            </p>
          </div>
          <Link href="/forum/new">
            <Button
              variant="success"
              className="flex items-center gap-2"
              onClick={() => {}}
            >
              <Plus size={20} />
              Uusi aihe
            </Button>
          </Link>
        </div>
      </Card>

      {topics.length === 0 ? (
        <Card>
          <p className="text-center text-gray-500 py-8">
            Ei vielä aiheita. Ole ensimmäinen ja aloita keskustelu!
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {topics.map((topic) => (
            <Link key={topic.id} href={`/forum/topic/${topic.id}`}>
              <Card className="hover:border-yellow-400 transition cursor-pointer py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 text-center">
                    <div className="text-2xl">{topic.category?.icon}</div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-gray-800 truncate">
                        {topic.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="text-yellow-600 font-medium">
                        {topic.category?.name}
                      </span>
                      <span className="truncate">
                        {topic.author?.username}
                      </span>
                      <div className="flex items-center gap-1">
                        <Eye size={12} />
                        <span>{topic.views}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-700">
                      {formatDate(topic.created_at)}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
