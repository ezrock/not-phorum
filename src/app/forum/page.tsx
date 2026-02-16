'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Eye, Plus } from 'lucide-react';
import { formatFinnishDateTime, formatFinnishRelative } from '@/lib/formatDate';

interface Topic {
  id: number;
  title: string;
  views: number;
  views_unique: number | null;
  created_at: string;
  category: { name: string; icon: string } | null;
  author: { username: string } | null;
}

interface RandomQuote {
  content: string;
  created_at: string;
  topic_id: number;
  author: { username: string } | null;
}

export default function ForumPage() {
  const { supabase } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [quote, setQuote] = useState<RandomQuote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopics = async () => {
      const { data, error } = await supabase
        .from('topics')
        .select(`
          id, title, views, views_unique, created_at,
          category:categories(name, icon),
          author:profiles!author_id(username)
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTopics(data as Topic[]);
      }
      setLoading(false);
    };

    const fetchRandomQuote = async () => {
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .gte('content', '');

      if (!count || count === 0) return;

      const randomOffset = Math.floor(Math.random() * count);
      const { data } = await supabase
        .from('posts')
        .select('content, created_at, topic_id, author:profiles!author_id(username)')
        .is('deleted_at', null)
        .range(randomOffset, randomOffset);

      if (data && data.length > 0) {
        const post = data[0] as RandomQuote;
        // Trim to first ~150 chars at a word boundary
        let snippet = post.content;
        if (snippet.length > 150) {
          snippet = snippet.substring(0, 150).replace(/\s+\S*$/, '') + '...';
        }
        setQuote({ ...post, content: snippet });
      }
    };

    const fetchMessageCount = async () => {
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null);

      setMessageCount(count || 0);
    };

    fetchTopics();
    fetchRandomQuote();
    fetchMessageCount();
  }, [supabase]);


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
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {quote && (
            <p className="text-gray-500 text-xs italic whitespace-normal break-words leading-relaxed">
              &ldquo;{quote.content}&rdquo; &mdash; {quote.author?.username},{' '}
              <Link href={`/forum/topic/${quote.topic_id}`} className="text-yellow-700 hover:underline not-italic">
                {formatFinnishDateTime(quote.created_at)}
              </Link>
            </p>
            )}
          </div>
          <p className="text-xs text-gray-500 whitespace-nowrap text-right">
            {topics.length} lankaa, {messageCount} viestiä.
          </p>
        </div>
        <Link href="/forum/new" className="block w-full mt-4">
          <Button
            variant="primary"
            className="w-full whitespace-normal text-center leading-tight flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Uusi aihe
          </Button>
        </Link>
      </div>

      {topics.length === 0 ? (
        <Card>
          <p className="text-center text-gray-500 py-8">
            Ei vielä aiheita. Ole ensimmäinen ja aloita keskustelu!
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-gray-200">
          {topics.map((topic) => (
            <Link key={topic.id} href={`/forum/topic/${topic.id}`} className="block hover:bg-yellow-50/40 transition">
              <div className="py-3 px-4">
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
                      <span className="truncate" style={{ fontFamily: 'monospace' }}>
                        {topic.author?.username}
                      </span>
                      <div className="flex items-center gap-1">
                        <Eye size={12} />
                        <span>{topic.views_unique ?? topic.views}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-700">
                      {formatFinnishRelative(topic.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          </div>
        </Card>
      )}
    </div>
  );
}
