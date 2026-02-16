'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { ScrollText, Image as ImageIcon, Link2, Search, User } from 'lucide-react';
import { formatFinnishDateTime } from '@/lib/formatDate';
import { postThumb, profileThumb } from '@/lib/cloudinary';

type EventType = 'image' | 'url';
type FilterType = 'all' | 'image' | 'url';

interface EventItem {
  id: string;
  type: EventType;
  created_at: string;
  topic_id: number;
  topic_title: string;
  author: {
    id: string;
    username: string;
    profile_image_url: string | null;
  } | null;
  image_url?: string;
  urls?: string[];
}

interface PostRow {
  id: number;
  content: string;
  created_at: string;
  image_url: string | null;
  topic_id: number;
  topic: { title: string } | null;
  author: {
    id: string;
    username: string;
    profile_image_url: string | null;
  } | null;
}

const URL_REGEX = /https?:\/\/[^\s)>\]]+/g;

function extractUrls(content: string): string[] {
  return [...content.matchAll(URL_REGEX)].map((m) => m[0]);
}

export default function LokiPage() {
  const { supabase } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      const [imageRes, urlRes] = await Promise.all([
        supabase
          .from('posts')
          .select('id, content, created_at, image_url, topic_id, topic:topics(title), author:profiles!author_id(id, username, profile_image_url)')
          .is('deleted_at', null)
          .not('image_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('posts')
          .select('id, content, created_at, image_url, topic_id, topic:topics(title), author:profiles!author_id(id, username, profile_image_url)')
          .is('deleted_at', null)
          .ilike('content', '%http%')
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      const eventList: EventItem[] = [];
      const seenIds = new Set<string>();

      if (imageRes.data) {
        for (const post of imageRes.data as PostRow[]) {
          const key = `image-${post.id}`;
          if (seenIds.has(key)) continue;
          seenIds.add(key);
          eventList.push({
            id: key,
            type: 'image',
            created_at: post.created_at,
            topic_id: post.topic_id,
            topic_title: post.topic?.title || '',
            author: post.author,
            image_url: post.image_url!,
          });
        }
      }

      if (urlRes.data) {
        for (const post of urlRes.data as PostRow[]) {
          const urls = extractUrls(post.content);
          if (urls.length === 0) continue;
          const key = `url-${post.id}`;
          if (seenIds.has(key)) continue;
          seenIds.add(key);
          eventList.push({
            id: key,
            type: 'url',
            created_at: post.created_at,
            topic_id: post.topic_id,
            topic_title: post.topic?.title || '',
            author: post.author,
            urls,
          });
        }
      }

      eventList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setEvents(eventList);
      setLoading(false);
    };

    fetchEvents();
  }, [supabase]);

  const filtered = useMemo(() => {
    let list = events;
    if (filter !== 'all') {
      list = list.filter((e) => e.type === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((e) => {
        if (e.author?.username.toLowerCase().includes(q)) return true;
        if (e.topic_title.toLowerCase().includes(q)) return true;
        if (e.urls?.some((u) => u.toLowerCase().includes(q))) return true;
        return false;
      });
    }
    return list;
  }, [events, filter, searchQuery]);

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
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <ScrollText size={28} className="text-gray-800" />
          <div>
            <h2 className="text-3xl font-bold">Loki</h2>
            <p className="text-gray-600">
              Yarr! {events.length} tapahtumaa{events.length > 0 && ` \u2014 viimeisin ${formatFinnishDateTime(events[0].created_at)}`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1">
          {([
            ['all', 'Kaikki'],
            ['image', 'Kuvat'],
            ['url', 'Linkit'],
          ] as [FilterType, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 text-sm rounded font-medium transition ${
                filter === value
                  ? 'bg-yellow-400 text-gray-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hae..."
            className="pl-8 pr-3 py-1.5 rounded border-2 border-gray-300 bg-white text-sm focus:outline-none focus:border-gray-800 w-48"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-center text-gray-500 py-8">
            Ei tapahtumia.
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filtered.map((event) => (
              <div key={event.id} className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 text-center pt-0.5">
                    {event.type === 'image' ? (
                      <ImageIcon size={20} className="text-yellow-600 mx-auto" />
                    ) : (
                      <Link2 size={20} className="text-yellow-600 mx-auto" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {event.author && (
                        <Link href={`/profile/${event.author.id}`} className="flex items-center gap-1.5 hover:opacity-80">
                          {event.author.profile_image_url ? (
                            <img src={profileThumb(event.author.profile_image_url)} alt={event.author.username} className="w-5 h-5 rounded-none object-cover" />
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 inline-flex items-center justify-center">
                              <User size={11} />
                            </span>
                          )}
                          <span className="font-bold text-sm text-gray-800">{event.author.username}</span>
                        </Link>
                      )}
                      <span className="text-xs text-gray-400">
                        {event.type === 'image' ? 'lisäsi kuvan' : 'jakoi linkin'}
                      </span>
                    </div>

                    <Link href={`/forum/topic/${event.topic_id}`} className="text-sm text-gray-600 hover:text-yellow-700 hover:underline truncate block">
                      {event.topic_title}
                    </Link>

                    {event.type === 'image' && event.image_url && (
                      <Link href={`/forum/topic/${event.topic_id}`}>
                        <img
                          src={postThumb(event.image_url)}
                          alt="Kuva"
                          className="mt-2 rounded-lg max-h-32 object-cover"
                        />
                      </Link>
                    )}

                    {event.type === 'url' && event.urls && (
                      <div className="mt-1 space-y-0.5">
                        {event.urls.slice(0, 3).map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-blue-600 hover:underline truncate"
                          >
                            {url}
                          </a>
                        ))}
                        {event.urls.length > 3 && (
                          <span className="text-xs text-gray-400">+{event.urls.length - 3} lisää</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <Link href={`/forum/topic/${event.topic_id}`} className="text-xs text-gray-500 hover:text-yellow-700 hover:underline">
                      {formatFinnishDateTime(event.created_at)}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
