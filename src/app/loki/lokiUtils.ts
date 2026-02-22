import type { EventItem, EventType, FilterType } from './types';
import { LOKI_FILTERS } from './types';

const URL_REGEX = /https?:\/\/[^\s)>\]]+/g;
const IMAGE_URL_REGEX = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const VIDEO_URL_REGEX = /\.(mp4|webm|mov|m4v|ogv|ogg)(\?.*)?$/i;

export function isLokiFilter(value: string): value is FilterType {
  return LOKI_FILTERS.includes(value as FilterType);
}

export function extractUrls(content: string): string[] {
  return [...content.matchAll(URL_REGEX)].map((match) => match[0]);
}

export function makePreview(content: string, maxLength = 220): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).replace(/\s+\S*$/, '')}...`;
}

export function getActionText(type: EventType): string {
  if (type === 'image') return 'lisäsi mediaa';
  if (type === 'video') return 'lisäsi videon';
  if (type === 'quote') return 'tykkäsi lainauksesta';
  return 'jakoi linkin';
}

export function extractYoutubeId(url: string): string | null {
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

export function hasVideoUrl(urls: string[]): boolean {
  return urls.some((url) => VIDEO_URL_REGEX.test(url) || Boolean(extractYoutubeId(url)));
}

export function getMediaForEvent(event: EventItem): { kind: 'image' | 'video'; url: string; previewImageUrl?: string } | null {
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
  if (!youtubeUrl) return null;
  const videoId = extractYoutubeId(youtubeUrl);
  if (!videoId) return null;
  return {
    kind: 'video',
    url: youtubeUrl,
    previewImageUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}
