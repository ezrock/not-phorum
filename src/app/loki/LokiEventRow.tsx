import Link from 'next/link';
import { Image as ImageIcon, Link2, User, Heart, Clapperboard } from 'lucide-react';
import { formatFinnishDateTime } from '@/lib/formatDate';
import { postThumb, profileThumb } from '@/lib/cloudinary';
import { getActionText, getMediaForEvent } from './lokiUtils';
import type { EventItem } from './types';

function EventTypeIcon({ type }: { type: EventItem['type'] }) {
  if (type === 'image') return <ImageIcon size={20} className="text-yellow-600 mx-auto" />;
  if (type === 'video') return <Clapperboard size={20} className="text-yellow-600 mx-auto" />;
  if (type === 'quote') return <Heart size={20} className="text-yellow-600 mx-auto" />;
  return <Link2 size={20} className="text-yellow-600 mx-auto" />;
}

export function LokiEventRow({ event }: { event: EventItem }) {
  const topicHref = `/topic/${event.topic_id}${event.post_id ? `#post-${event.post_id}` : ''}`;
  const media = getMediaForEvent(event);

  return (
    <div className="py-3">
      <div className={`flex gap-3 ${media ? 'items-start' : 'items-center'}`}>
        <div className="flex-shrink-0 w-8 text-center">
          <EventTypeIcon type={event.type} />
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
            <Link href={topicHref} className="content-inline-link font-medium">
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
                  <span className="text-muted-sm"> (+{event.urls.length - 1} lisää)</span>
                )}
              </span>
            )}
          </p>

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

        <div className="meta-right-slot">
          <Link href={topicHref} className="text-xs text-gray-500 hover:text-yellow-700 hover:underline">
            {formatFinnishDateTime(event.created_at)}
          </Link>
        </div>
      </div>
    </div>
  );
}
