'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { mockCategories, mockTopics, mockUsers } from '@/lib/mockData';
import Link from 'next/link';
import { MessageSquare, Eye, Pin, Lock, Plus } from 'lucide-react';

export default function ForumPage() {
  // Sort topics: pinned first, then by last activity
  const sortedTopics = [...mockTopics].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });

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
          <Button variant="success" className="flex items-center gap-2">
            <Plus size={20} />
            Uusi aihe
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {sortedTopics.map((topic) => {
          const author = mockUsers.find((user) => user.id === topic.authorId);
          const category = mockCategories.find((cat) => cat.id === topic.categoryId);

          return (
            <Link key={topic.id} href={`/forum/topic/${topic.id}`}>
              <Card className="hover:border-yellow-400 transition cursor-pointer py-3 px-4">
                <div className="flex items-center gap-3">
                  {/* Category Icon */}
                  <div className="flex-shrink-0 w-8 text-center">
                    <div className="text-2xl">{category?.icon}</div>
                  </div>

                  {/* Topic Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {topic.isPinned && (
                        <Pin size={14} className="text-yellow-600 flex-shrink-0" fill="currentColor" />
                      )}
                      {topic.isLocked && (
                        <Lock size={14} className="text-gray-500 flex-shrink-0" />
                      )}
                      <h3 className="text-lg font-bold text-gray-800 truncate">
                        {topic.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="text-yellow-600 font-medium">
                        {category?.name}
                      </span>
                      <span className="truncate">
                        {author?.username}
                      </span>
                      <div className="flex items-center gap-1">
                        <MessageSquare size={12} />
                        <span>{topic.replyCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye size={12} />
                        <span>{topic.views}</span>
                      </div>
                    </div>
                  </div>

                  {/* Last Activity */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-700">
                      {formatDate(topic.lastActivity)}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
