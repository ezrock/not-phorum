import type { EventItem, RawPostRow, RawQuoteLikeEventRow } from './types';
import { extractUrls, hasVideoUrl, makePreview } from './lokiUtils';
import type { SupabaseClient } from '@supabase/supabase-js';

function appendImageEvents(eventList: EventItem[], seenIds: Set<string>, rows: RawPostRow[]): void {
  for (const post of rows) {
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
      image_url: post.image_url || undefined,
    });
  }
}

function appendUrlEvents(eventList: EventItem[], seenIds: Set<string>, rows: RawPostRow[]): void {
  for (const post of rows) {
    const urls = extractUrls(post.content);
    if (urls.length === 0) continue;
    const key = `url-${post.id}`;
    if (seenIds.has(key)) continue;
    seenIds.add(key);
    eventList.push({
      id: key,
      type: hasVideoUrl(urls) ? 'video' : 'url',
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

function appendQuoteLikeEvents(eventList: EventItem[], rows: RawQuoteLikeEventRow[]): void {
  for (const rawEvent of rows) {
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

export async function fetchLokiEvents(supabase: SupabaseClient): Promise<EventItem[]> {
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
    appendImageEvents(eventList, seenIds, imageRes.data as unknown as RawPostRow[]);
  }
  if (urlRes.data) {
    appendUrlEvents(eventList, seenIds, urlRes.data as unknown as RawPostRow[]);
  }
  if (quoteLikeRes.data) {
    appendQuoteLikeEvents(eventList, quoteLikeRes.data as unknown as RawQuoteLikeEventRow[]);
  }

  eventList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return eventList;
}
