import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { formatFinnishRelative } from '@/lib/formatDate';
import type { Topic } from '@/hooks/useForumTopics';
import { TagChip } from '@/components/ui/TagChip';
import { TagIcon } from '@/components/ui/TagIcon';

interface ForumThreadListProps {
  topics: Topic[];
  threadCount: number;
  visibleCount: number;
  loadingMore: boolean;
  unreadOnly: boolean;
  requestedTagIds: number[];
  onShowMore: () => void | Promise<void>;
}

function formatUnreadLabel(unreadCount: number) {
  return `${Math.max(0, unreadCount)} uutta`;
}

function formatMessagesLabel(repliesCount: number) {
  const totalMessages = Math.max(1, repliesCount + 1);
  return `${totalMessages} ${totalMessages === 1 ? 'viesti' : 'viestiä'}`;
}

export function ForumThreadList({
  topics,
  threadCount,
  visibleCount,
  loadingMore,
  unreadOnly,
  requestedTagIds,
  onShowMore,
}: ForumThreadListProps) {
  const filteredTopics = unreadOnly ? topics.filter((topic) => topic.has_new) : topics;
  const displayedTopicCount = Math.min(visibleCount, filteredTopics.length);
  const visibleTopics = filteredTopics.slice(0, displayedTopicCount);
  const hasUnloadedPages = topics.length < threadCount;
  const canShowMore = displayedTopicCount < filteredTopics.length || hasUnloadedPages;

  if (topics.length === 0) {
    return (
      <Card>
        <Link href="/new" className="block mb-4">
          <Button
            variant="primary"
            className="w-full whitespace-normal text-center leading-tight flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Uusi aihe
          </Button>
        </Link>
        <p className="text-center text-gray-500 py-8">
          {requestedTagIds.length > 0
            ? 'Ei aiheita valituilla tageilla.'
            : 'Ei vielä aiheita. Ole ensimmäinen ja aloita keskustelu!'}
        </p>
      </Card>
    );
  }

  if (unreadOnly && filteredTopics.length === 0) {
    return (
      <Card>
        <Link href="/new" className="block mb-4">
          <Button
            variant="primary"
            className="w-full whitespace-normal text-center leading-tight flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Uusi aihe
          </Button>
        </Link>
        <p className="text-center text-gray-500 py-8">Ei lukemattomia lankoja nykyisellä suodatuksella.</p>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="pb-8 border-b border-gray-200">
          <Link href="/new" className="block">
            <Button
              variant="primary"
              className="w-full whitespace-normal text-center leading-tight flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Uusi aihe
            </Button>
          </Link>
        </div>
        <div className="divide-y divide-gray-200">
          {visibleTopics.map((topic) => {
            const jumpPostId = topic.jump_post_id ?? topic.last_post_id;
            const topicHref = `/topic/${topic.id}${jumpPostId ? `#post-${jumpPostId}` : ''}`;
            const hasUnread = topic.unread_count > 0;

            return (
              <Link
                key={topic.id}
                href={topicHref}
                className="forum-thread-link block transition hover:bg-yellow-50/40"
              >
                <div className="forum-thread-row py-2.5 flex items-start gap-3 md:items-center md:gap-4 text-base">
                  <div className="forum-thread-icon-wrap w-8 shrink-0 text-center">
                    <TagIcon
                      icon={topic.category_icon}
                      alt={`${topic.category_name} icon`}
                      className="forum-thread-icon text-2xl leading-none inline-block"
                      style={{ width: '1.5rem', height: '1.5rem', objectFit: 'contain' }}
                    />
                  </div>

                  <div className="forum-thread-main min-w-0 flex-1">
                    <div className="forum-thread-title-line flex items-center gap-2">
                      <h3
                        className={`forum-thread-title min-w-0 truncate text-gray-800 ${
                          topic.unread_count > 0 ? 'is-unread' : 'is-read'
                        }`}
                      >
                        {topic.title}
                      </h3>
                    </div>

                    <div className="forum-thread-mobile-meta">
                      <TagChip size="xs" className="forum-thread-mobile-category">
                        {topic.category_name}
                      </TagChip>
                      <span aria-hidden="true">•</span>
                      <span className="forum-thread-mobile-author">{topic.author_username}</span>
                      <span aria-hidden="true">•</span>
                      {hasUnread ? (
                        <span className="forum-thread-badge forum-thread-badge-mobile">
                          {formatUnreadLabel(topic.unread_count)}
                        </span>
                      ) : (
                        <span>{formatMessagesLabel(topic.replies_count)}</span>
                      )}
                      <span aria-hidden="true">•</span>
                      <span>{formatFinnishRelative(topic.last_post_created_at || topic.created_at)}</span>
                    </div>
                  </div>

                  <div className="forum-thread-meta">
                    <span className="forum-thread-meta-item forum-thread-meta-category">
                      <TagChip size="xs">{topic.category_name}</TagChip>
                    </span>
                    <span className="forum-thread-meta-item forum-thread-meta-author">{topic.author_username}</span>
                    <span className="forum-thread-meta-item tabular-nums">
                      {hasUnread ? (
                        <span className="forum-thread-badge">{formatUnreadLabel(topic.unread_count)}</span>
                      ) : (
                        formatMessagesLabel(topic.replies_count)
                      )}
                    </span>
                    <span className="forum-thread-meta-item forum-thread-meta-time tabular-nums">
                      {formatFinnishRelative(topic.last_post_created_at || topic.created_at)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>

      {canShowMore && (
        <div className="mt-4 flex flex-col items-center gap-2 text-sm">
          <Button type="button" variant="outline" onClick={onShowMore} disabled={loadingMore} className="min-w-44">
            {loadingMore ? 'Ladataan...' : 'Näytä lisää'}
          </Button>
          <p className="text-xs text-gray-500">
            Näytetään {displayedTopicCount} / {threadCount} lankaa
          </p>
        </div>
      )}
    </>
  );
}
