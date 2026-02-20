import Link from 'next/link';
import { MessageSquare, LogIn, Eye, BarChart3 } from 'lucide-react';
import type { TopicStat } from '@/hooks/useProfileStats';

interface ProfileStatsProps {
  postCount: number;
  topicCount: number;
  loginCount: number;
  loginNetworkCount?: number;
  mostPopularTopic: TopicStat | null;
  mostActiveTopic: TopicStat | null;
}

export function ProfileStats({
  postCount,
  topicCount,
  loginCount,
  loginNetworkCount = 0,
  mostPopularTopic,
  mostActiveTopic,
}: ProfileStatsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <MessageSquare size={18} className="text-yellow-600" />
        <span className="text-muted-sm flex-1">Viestiä</span>
        <span className="font-bold">{postCount}</span>
      </div>
      <div className="flex items-center gap-3">
        <MessageSquare size={18} className="text-yellow-600" />
        <span className="text-muted-sm flex-1">Aloitettua aihetta</span>
        <span className="font-bold">{topicCount}</span>
      </div>
      <div className="flex items-center gap-3">
        <LogIn size={18} className="text-yellow-600" />
        <span className="text-muted-sm flex-1">Kirjautumista</span>
        <span className="font-bold">{loginCount}</span>
      </div>
      <div className="flex items-center gap-3">
        <LogIn size={18} className="text-yellow-600" />
        <span className="text-muted-sm flex-1">
          Vierailut eri IP-osoitteista (
          <a
            href="https://github.com/ezrock/not-phorum/commit/484bdab3f913da96ee81ca1d6eae63228513f7c4"
            target="_blank"
            rel="noopener noreferrer"
          >
            Github
          </a>
          )
        </span>
        <span className="font-bold">{loginNetworkCount}</span>
      </div>
      {mostPopularTopic && (
        <Link href={`/topic/${mostPopularTopic.id}`} className="stat-link-row">
          <Eye size={18} className="text-yellow-600" />
          <span className="text-muted-sm flex-shrink-0">Suosituin aihe</span>
          <span className="stat-value-primary">{mostPopularTopic.title}</span>
          <span className="stat-value-secondary">{mostPopularTopic.views} katselua</span>
        </Link>
      )}
      {mostActiveTopic && (
        <Link href={`/topic/${mostActiveTopic.id}`} className="stat-link-row">
          <BarChart3 size={18} className="text-yellow-600" />
          <span className="text-muted-sm flex-shrink-0">Aktiivisin aihe</span>
          <span className="stat-value-primary">{mostActiveTopic.title}</span>
          <span className="stat-value-secondary">{mostActiveTopic.reply_count} vastausta</span>
        </Link>
      )}
    </div>
  );
}
