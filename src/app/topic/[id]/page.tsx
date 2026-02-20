'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useTopicPageData } from '@/hooks/topic/useTopicPageData';
import { TopicPageView } from '@/components/forum/topic';

function TopicContent() {
  const params = useParams();
  const { currentUser, supabase, profile } = useAuth();
  const topicId = parseInt(params.id as string, 10);

  const topicPage = useTopicPageData({
    topicId,
    currentUser,
    supabase,
    profile: profile as { is_admin?: boolean; realtime_updates_enabled?: boolean; legacy_tag_icons_enabled?: boolean } | null,
  });

  return <TopicPageView currentUser={currentUser} {...topicPage} />;
}

export default function TopicPage() {
  return (
    <Suspense
      fallback={
        <div className="layout-page-shell">
          <Card>
            <p className="state-empty-text">Ladataan...</p>
          </Card>
        </div>
      }
    >
      <TopicContent />
    </Suspense>
  );
}
