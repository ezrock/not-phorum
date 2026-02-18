'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { ScrollText, Image as ImageIcon, Link2, Search, User, Heart, Clapperboard } from 'lucide-react';
import { formatFinnishDateTime } from '@/lib/formatDate';
import { postThumb, profileThumb } from '@/lib/cloudinary';

type EventType = 'image' | 'video' | 'url' | 'quote';
type FilterType = 'all' | 'image' | 'video' | 'url' | 'quote';

interface EventItem {
  id: string;
  type: EventType;
  created_at: string;
  topic_id: number;
  post_id?: number;
  topic_title: string;
  content_preview?: string;
  author: {
    id: string;
    username: string;
    profile_image_url: string | null;
  } | null;
  image_url?: string;
  urls?: string[];
  quote_preview?: string;
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

interface QuoteLikeEventRow {
  id: number;
  created_at: string;
  post_id: number;
  topic_id: number;
  topic: { title: string }[] | { title: string } | null;
  post: { content: string }[] | { content: string } | null;
  actor: {
    id: string;
    username: string;
    profile_image_url: string | null;
  }[] | {
    id: string;
    username: string;
    profile_image_url: string | null;
  } | null;
}

const URL_REGEX = /https?:\/\/[^\s)>\]]+/g;
const IMAGE_URL_REGEX = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const VIDEO_URL_REGEX = /\.(mp4|webm|mov|m4v|ogv|ogg)(\?.*)?$/i;

function extractUrls(content: string): string[] {
  return [...content.matchAll(URL_REGEX)].map((m) => m[0]);
}

function makePreview(content: string, maxLength = 220): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).replace(/\s+\S*$/, '')}...`;
}

function getActionText(type: EventType): string {
  if (type === 'image') return 'lisäsi mediaa';
  if (type === 'video') return 'lisäsi videon';
  if (type === 'quote') return 'tykkäsi lainauksesta';
  return 'jakoi linkin';
}

function extractYoutubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = parsed.searchParams.get('v');
      if (v) return v;
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/')[2] || null;
      }
    }
    if (host === 'youtu.be') {
      return parsed.pathname.split('/').filter(Boolean)[0] || null;
    }
  } catch {
    return null;
  }
  return null;
}

function getMediaForEvent(event: EventItem): { kind: 'image' | 'video'; url: string; previewImageUrl?: string } | null {
  if (event.image_url) {
    return { kind: 'image', url: event.image_url };
  }

  if (!event.urls || event.urls.length === 0) return null;
  const imageUrl = event.urls.find((url) => IMAGE_URL_REGEX.test(url));
  if (imageUrl) return { kind: 'image', url: imageUrl };

  const directVideoUrl = event.urls.find((url) => VIDEO_URL_REGEX.test(url));
  if (directVideoUrl) {
    return { kind: 'video', url: directVideoUrl, previewImageUrl: '/window.svg' };
  }

  const youtubeUrl = event.urls.find((url) => Boolean(extractYoutubeId(url)));
  if (youtubeUrl) {
    const videoId = extractYoutubeId(youtubeUrl);
    if (videoId) {
      return {
        kind: 'video',
        url: youtubeUrl,
        previewImageUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
  }

  return null;
}

export default function LokiPage() {
  const { supabase } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      const [imageRes, urlRes, quoteLikeRes] = await Promise.all([
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
        supabase
          .from('quote_like_events')
          .select(`
            id, created_at, post_id, topic_id,
            topic:topics(title),
            post:posts(content),
            actor:profiles!liked_by_profile_id(id, username, profile_image_url)
          `)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      const eventList: EventItem[] = [];
      const seenIds = new Set<string>();

      if (imageRes.data) {
        for (const post of imageRes.data as unknown as PostRow[]) {
          const key = `image-${post.id}`;
          if (seenIds.has(key)) continue;
          seenIds.add(key);
          eventList.push({
            id: key,
            type: 'image',
            created_at: post.created_at,
            topic_id: post.topic_id,
            post_id: post.id,
            topic_title: post.topic?.title || '',
            content_preview: makePreview(post.content || ''),
            author: post.author,
            image_url: post.image_url!,
          });
        }
      }

      if (urlRes.data) {
        for (const post of urlRes.data as unknown as PostRow[]) {
          const urls = extractUrls(post.content);
          if (urls.length === 0) continue;
          const key = `url-${post.id}`;
          if (seenIds.has(key)) continue;
          seenIds.add(key);
          const hasVideoUrl = urls.some((url) => VIDEO_URL_REGEX.test(url) || Boolean(extractYoutubeId(url)));
          eventList.push({
            id: key,
            type: hasVideoUrl ? 'video' : 'url',
            created_at: post.created_at,
            topic_id: post.topic_id,
            post_id: post.id,
            topic_title: post.topic?.title || '',
            content_preview: makePreview(post.content || ''),
            author: post.author,
            urls,
          });
        }
      }

      if (quoteLikeRes.data) {
        for (const rawEvent of quoteLikeRes.data as unknown as QuoteLikeEventRow[]) {
          const topic = Array.isArray(rawEvent.topic) ? rawEvent.topic[0] : rawEvent.topic;
          const post = Array.isArray(rawEvent.post) ? rawEvent.post[0] : rawEvent.post;
          const actor = Array.isArray(rawEvent.actor) ? rawEvent.actor[0] : rawEvent.actor;

          if (!actor) continue;

          const preview = makePreview(post?.content || '', 140);

          eventList.push({
            id: `quote-${rawEvent.id}`,
            type: 'quote',
            created_at: rawEvent.created_at,
            topic_id: rawEvent.topic_id,
            post_id: rawEvent.post_id,
            topic_title: topic?.title || '',
            content_preview: preview,
            author: actor,
            quote_preview: preview,
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
      <div className="page-container">
        <Card>
          <p className="text-center text-gray-500 py-8">Ladataan...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <ScrollText size={28} className="text-gray-800" />
          <h2 className="text-3xl font-bold">Loki</h2>
        </div>
        <p className="text-gray-600 mt-1">
          Yarr! {events.length} tapahtumaa{events.length > 0 && ` — viimeisin ${formatFinnishDateTime(events[0].created_at)}`}
        </p>
      </div>

      <div className="page-tabs mb-4">
        <div className="flex gap-2 flex-wrap">
          {([
            ['all', 'Kaikki'],
            ['image', 'Kuvat'],
            ['video', 'Videot'],
            ['url', 'Linkit'],
            ['quote', 'Lainaukset'],
          ] as [FilterType, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`page-tab-button ${filter === value ? 'is-active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={16} className="app-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hae..."
            className="app-search-input w-48"
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
        <Card className="overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filtered.map((event) => {
              const topicHref = `/forum/topic/${event.topic_id}${event.post_id ? `#post-${event.post_id}` : ''}`;
              const media = getMediaForEvent(event);
              const rowAlignmentClass = media ? 'items-start' : 'items-center';

              return (
                <div key={event.id} className="py-3">
                  <div className={`flex gap-3 ${rowAlignmentClass}`}>
                    <div className="flex-shrink-0 w-8 text-center">
                      {event.type === 'image' ? (
                        <ImageIcon size={20} className="text-yellow-600 mx-auto" />
                      ) : event.type === 'video' ? (
                        <Clapperboard size={20} className="text-yellow-600 mx-auto" />
                      ) : event.type === 'quote' ? (
                        <Heart size={20} className="text-yellow-600 mx-auto" />
                      ) : (
                        <Link2 size={20} className="text-yellow-600 mx-auto" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-base text-gray-700 inline-flex items-center gap-1 flex-wrap">
                        {event.author && (
                          <Link href={`/profile/${event.author.id}`} className="inline-flex items-center gap-1.5 hover:opacity-80">
                            {event.author.profile_image_url ? (
                              <img src={profileThumb(event.author.profile_image_url)} alt={event.author.username} className="avatar-inline-sm" />
                            ) : (
                              <span className="avatar-inline-sm-fallback">
                                <User size={10} />
                              </span>
                            )}
                            <span className="font-bold text-base leading-5 text-gray-800">{event.author.username}</span>
                          </Link>
                        )}
                        <span>
                          {event.type === 'quote' ? 'tykkäsi lainauksesta ketjuun ' : `${getActionText(event.type)} ketjuun `}
                        </span>
                        <Link href={topicHref} className="text-yellow-700 hover:underline font-medium">
                          {event.topic_title}
                        </Link>
                        {event.type === 'quote' && event.content_preview && (
                          <span className="text-gray-600">: &ldquo;{event.content_preview}&rdquo;</span>
                        )}
                        {(event.type === 'url' || event.type === 'video') && event.urls && event.urls.length > 0 && (
                          <span className="text-gray-600">
                            :{' '}
                            <a
                              href={event.urls[0]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="app-link"
                            >
                              {event.urls[0]}
                            </a>
                            {event.urls.length > 1 && (
                              <span className="text-sm text-gray-500"> (+{event.urls.length - 1} lisää)</span>
                            )}
                          </span>
                        )}
                      </p>

                      {event.content_preview && event.type !== 'quote' && event.type !== 'url' && event.type !== 'image' && event.type !== 'video' && (
                        <p className="mt-1 text-base text-gray-600 break-words">{event.content_preview}</p>
                      )}

                      {media && (
                        <a href={media.url} target="_blank" rel="noopener noreferrer" className="mt-2 block w-fit">
                          {media.kind === 'image' || media.previewImageUrl ? (
                            <img
                              src={media.kind === 'image' ? postThumb(media.url) : media.previewImageUrl}
                              alt="Media thumbnail"
                              className="h-32 rounded-lg object-cover"
                            />
                          ) : (
                            <video
                              src={media.url}
                              className="h-32 rounded-lg object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                          )}
                        </a>
                      )}

                    </div>

                    <div className="text-right flex-shrink-0">
                      <Link href={topicHref} className="text-xs text-gray-500 hover:text-yellow-700 hover:underline">
                        {formatFinnishDateTime(event.created_at)}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
