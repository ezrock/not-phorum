import Link from 'next/link';
import { MessageSquare, LogIn, Eye, BarChart3 } from 'lucide-react';
import type { TopicStat, TopTagStat } from '@/hooks/useProfileStats';

interface ProfileStatsProps {
  postCount: number;
  topicCount: number;
  loginCount: number;
  loginNetworkCount?: number;
  mostPopularTopic: TopicStat | null;
  mostActiveTopic: TopicStat | null;
  topTags: TopTagStat[];
}

export function ProfileStats({
  postCount,
  topicCount,
  loginCount,
  loginNetworkCount = 0,
  mostPopularTopic,
  mostActiveTopic,
  topTags,
}: ProfileStatsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <MessageSquare size={18} className="text-yellow-600" />
        <span className="text-sm text-gray-500 flex-1">Viestiä</span>
        <span className="font-bold">{postCount}</span>
      </div>
      <div className="flex items-center gap-3">
        <MessageSquare size={18} className="text-yellow-600" />
        <span className="text-sm text-gray-500 flex-1">Aloitettua aihetta</span>
        <span className="font-bold">{topicCount}</span>
      </div>
      <div className="flex items-center gap-3">
        <LogIn size={18} className="text-yellow-600" />
        <span className="text-sm text-gray-500 flex-1">Kirjautumista</span>
        <span className="font-bold">{loginCount}</span>
      </div>
      <div className="flex items-center gap-3">
        <LogIn size={18} className="text-yellow-600" />
        <span className="text-sm text-gray-500 flex-1">
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
        <Link href={`/forum/topic/${mostPopularTopic.id}`} className="flex items-center gap-3 hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition">
          <Eye size={18} className="text-yellow-600" />
          <span className="text-sm text-gray-500 flex-shrink-0">Suosituin aihe</span>
          <span className="font-bold text-sm text-right flex-1 truncate">{mostPopularTopic.title}</span>
          <span className="text-xs text-gray-400 flex-shrink-0">{mostPopularTopic.views} katselua</span>
        </Link>
      )}
      {mostActiveTopic && (
        <Link href={`/forum/topic/${mostActiveTopic.id}`} className="flex items-center gap-3 hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition">
          <BarChart3 size={18} className="text-yellow-600" />
          <span className="text-sm text-gray-500 flex-shrink-0">Aktiivisin aihe</span>
          <span className="font-bold text-sm text-right flex-1 truncate">{mostActiveTopic.title}</span>
          <span className="text-xs text-gray-400 flex-shrink-0">{mostActiveTopic.reply_count} vastausta</span>
        </Link>
      )}
      {topTags.length > 0 && (
        <div className="pt-1">
          <p className="text-xs text-gray-500 mb-2">Käytetyimmät tagit</p>
          <div className="flex flex-wrap gap-2">
            {topTags.map((tag) => (
              <Link
                key={tag.tag_id}
                href={`/forum?tags=${tag.tag_id}`}
                className="inline-flex items-center gap-1 rounded-full border border-yellow-300 bg-yellow-50 px-2.5 py-1 text-xs text-yellow-900 hover:bg-yellow-100"
              >
                <span>{tag.tag_name}</span>
                <span className="text-yellow-700">({tag.usage_count})</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
