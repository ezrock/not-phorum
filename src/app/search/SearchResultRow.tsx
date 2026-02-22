import Link from 'next/link';
import { MessageSquare, FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import { TagIcon } from '@/components/ui/TagIcon';
import { formatFinnishRelative } from '@/lib/formatDate';
import type { SearchResult } from './types';

export function SearchResultRow({
  result,
  query,
  highlight,
}: {
  result: SearchResult;
  query: string;
  highlight: (text: string, needle: string) => ReactNode;
}) {
  return (
    <Link
      href={`/topic/${result.topic_id}`}
      className="block hover:bg-yellow-50 transition"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-shrink-0 w-8 text-center">
          <TagIcon
            icon={result.category_icon}
            alt={`${result.category_name} icon`}
            className="tag-icon-sm text-2xl"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {result.result_type === 'topic' ? (
              <FileText size={14} className="text-yellow-600 flex-shrink-0" />
            ) : (
              <MessageSquare size={14} className="text-blue-500 flex-shrink-0" />
            )}
            <h3 className="text-lg font-bold text-gray-800 truncate">
              {highlight(result.topic_title, query)}
            </h3>
          </div>

          {result.content_snippet && (
            <p className="text-sm text-gray-600 truncate mb-1">
              {highlight(result.content_snippet, query)}
            </p>
          )}

          <div className="flex items-center gap-3 text-muted-xs">
            <span className="text-yellow-600 font-medium">{result.category_name}</span>
            <span>{result.author_username}</span>
            <span className={result.result_type === 'topic' ? 'text-yellow-700' : 'text-blue-600'}>
              {result.result_type === 'topic' ? 'Aihe' : 'Viesti'}
            </span>
          </div>
        </div>

        <div className="meta-right-slot">
          <p className="text-xs font-semibold text-gray-700">
            {formatFinnishRelative(result.last_post_created_at || result.created_at)}
          </p>
        </div>
      </div>
    </Link>
  );
}
