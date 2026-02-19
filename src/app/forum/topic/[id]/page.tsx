'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useTopicPageData } from '@/hooks/useTopicPageData';
import { TopicPageView } from '@/components/forum/TopicPageView';

function TopicContent() {
  const params = useParams();
  const { currentUser, supabase, profile } = useAuth();
  const topicId = parseInt(params.id as string, 10);

  const topicPage = useTopicPageData({
    topicId,
    currentUser,
    supabase,
    profile: profile as { is_admin?: boolean; realtime_updates_enabled?: boolean } | null,
  });

  return <TopicPageView currentUser={currentUser} {...topicPage} />;
}

export default function TopicPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto mt-8 px-4">
          <Card>
            <p className="text-center text-gray-500 py-8">Ladataan...</p>
          </Card>
        </div>
      }
    >
      <TopicContent />
    </Suspense>
  );
}
