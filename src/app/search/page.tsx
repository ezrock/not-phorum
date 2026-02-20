'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { SearchInput } from '@/components/ui/SearchInput';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Search, MessageSquare, FileText, ArrowLeft } from 'lucide-react';
import { formatFinnishRelative } from '@/lib/formatDate';
import type { ReactNode } from 'react';
import { TagChipLink } from '@/components/ui/TagChipLink';

interface SearchResult {
  result_type: 'topic' | 'post';
  topic_id: number;
  topic_title: string;
  content_snippet: string | null;
  category_name: string;
  category_icon: string;
  author_username: string;
  author_profile_image_url: string | null;
  similarity_score: number;
  created_at: string;
  last_post_created_at: string | null;
}

interface TagHit {
  id: number;
  name: string;
  slug: string;
  icon?: string;
}

interface TagGroupHit {
  group_id: number;
  group_name: string;
  group_slug: string;
  member_count: number;
  member_tag_ids: number[];
}

type SearchFilter = 'all' | 'topics' | 'posts' | 'tags' | 'groups';
type SearchSortMode = 'latest' | 'best';

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { supabase } = useAuth();

  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<SearchResult[]>([]);
  const [tagHits, setTagHits] = useState<TagHit[]>([]);
  const [groupHits, setGroupHits] = useState<TagGroupHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(query);
  const [searchError, setSearchError] = useState('');
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('all');
  const [sortMode, setSortMode] = useState<SearchSortMode>(() => {
    if (typeof window === 'undefined') return 'latest';
    const saved = window.localStorage.getItem('search.sortMode');
    return saved === 'best' ? 'best' : 'latest';
  });

  const highlightMatch = (text: string, needle: string): ReactNode => {
    const trimmedNeedle = needle.trim();
    if (!trimmedNeedle) return text;

    const escaped = trimmedNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);

    const lowerNeedle = trimmedNeedle.toLocaleLowerCase();
    return parts.map((part, index) =>
      part.toLocaleLowerCase() === lowerNeedle ? (
        <mark key={`${part}-${index}`} className="bg-yellow-100 text-inherit rounded px-0.5">
          {part}
        </mark>
      ) : (
        <span key={`${part}-${index}`}>{part}</span>
      )
    );
  };

  const performSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      setTagHits([]);
      setGroupHits([]);
      setSearchError('');
      return;
    }
    setLoading(true);
    setSearchError('');
    const trimmedTerm = term.trim();

    const [contentRes, tagRes, groupRes] = await Promise.all([
      supabase.rpc('search_forum', {
        search_term: trimmedTerm,
        result_limit: 30,
      }),
      fetch(`/api/tags?status=approved&query=${encodeURIComponent(trimmedTerm)}&limit=8`, {
        cache: 'no-store',
      }),
      supabase.rpc('search_tag_groups', {
        input_query: trimmedTerm,
        input_limit: 6,
      }),
    ]);

    const { data, error } = contentRes;
    if (!error && data) {
      setResults(data as SearchResult[]);
    } else {
      setResults([]);
      setSearchError(error?.message || 'Haku epäonnistui');
    }

    if (tagRes.ok) {
      const payload = (await tagRes.json()) as { tags?: TagHit[] };
      setTagHits(payload.tags || []);
    } else {
      setTagHits([]);
    }

    if (!groupRes.error && groupRes.data) {
      const normalizedGroups = ((groupRes.data || []) as Record<string, unknown>[]).map((row) => ({
        group_id: Number(row.group_id),
        group_name: String(row.group_name ?? ''),
        group_slug: String(row.group_slug ?? ''),
        member_count: Number(row.member_count ?? 0),
        member_tag_ids: Array.isArray(row.member_tag_ids)
          ? row.member_tag_ids
              .map((value) => Number.parseInt(String(value), 10))
              .filter((value) => Number.isFinite(value) && value > 0)
          : [],
      })) as TagGroupHit[];
      setGroupHits(normalizedGroups);
    } else {
      setGroupHits([]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void performSearch(query);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [query, performSearch]);

  useEffect(() => {
    window.localStorage.setItem('search.sortMode', sortMode);
  }, [sortMode]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed.length >= 2) {
      setActiveFilter('all');
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const sortByLastActivity = (a: SearchResult, b: SearchResult) => {
    const aTime = new Date(a.last_post_created_at || a.created_at).getTime();
    const bTime = new Date(b.last_post_created_at || b.created_at).getTime();
    return bTime - aTime;
  };
  const sortByBest = (a: SearchResult, b: SearchResult) => {
    if (b.similarity_score !== a.similarity_score) {
      return b.similarity_score - a.similarity_score;
    }
    return sortByLastActivity(a, b);
  };
  const resultSorter = sortMode === 'best' ? sortByBest : sortByLastActivity;

  const topicResults = results.filter((result) => result.result_type === 'topic').sort(resultSorter);
  const postResults = results.filter((result) => result.result_type === 'post').sort(resultSorter);
  const allContentResults = [...topicResults, ...postResults].sort(resultSorter);

  const visibleContentResults = activeFilter === 'topics'
    ? topicResults
    : activeFilter === 'posts'
      ? postResults
      : allContentResults;

  const visibleTags = activeFilter === 'groups' ? [] : tagHits;
  const visibleGroups = activeFilter === 'tags' ? [] : groupHits;
  const showsTagSection = activeFilter === 'all' || activeFilter === 'tags' || activeFilter === 'groups';
  const showsContentSection = activeFilter === 'all' || activeFilter === 'topics' || activeFilter === 'posts';

  const filterButtonClass = (filter: SearchFilter) =>
    `text-sm underline underline-offset-2 ${activeFilter === filter ? 'text-yellow-700 font-semibold' : 'text-gray-600 hover:text-yellow-700'}`;

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Search size={28} className="text-gray-800" />
          <h2 className="text-3xl font-bold">Haku</h2>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <SearchInput
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Hae aiheista ja viesteistä..."
            wrapperClassName="flex-1"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-bold rounded transition"
          >
            Hae
          </button>
        </form>

        {query && loading && <p className="mt-3 text-sm text-gray-600">Haetaan...</p>}
      </div>

      <div className="mb-4">
        <Link href="/" className="app-back-link">
          <ArrowLeft size={16} />
          Takaisin foorumille
        </Link>
      </div>

      {loading ? (
        <Card>
          <p className="text-center text-gray-500 py-8">Haetaan tuloksia...</p>
        </Card>
      ) : searchError ? (
        <Card>
          <p className="text-center text-red-600 py-8">
            Haku epäonnistui: {searchError}
          </p>
        </Card>
      ) : (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-800">Hakutulokset</h3>
              <div className="inline-flex items-center rounded-md border border-gray-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSortMode('latest')}
                  className={`px-3 py-1 text-xs font-medium transition ${
                    sortMode === 'latest' ? 'bg-yellow-100 text-yellow-800' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Uusimmat
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode('best')}
                  className={`px-3 py-1 text-xs font-medium transition border-l border-gray-300 ${
                    sortMode === 'best' ? 'bg-yellow-100 text-yellow-800' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Parhaat
                </button>
              </div>
            </div>

            {query && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
<button type="button" className={filterButtonClass('all')} onClick={() => setActiveFilter('all')}>
                  Kaikki:
                </button>
                <button type="button" className={filterButtonClass('topics')} onClick={() => setActiveFilter('topics')}>
                  {topicResults.length} lankaa
                </button>
                <button type="button" className={filterButtonClass('posts')} onClick={() => setActiveFilter('posts')}>
                  {postResults.length} viestiä
                </button>
                <button type="button" className={filterButtonClass('tags')} onClick={() => setActiveFilter('tags')}>
                  {tagHits.length} aihetta
                </button>
                <button type="button" className={filterButtonClass('groups')} onClick={() => setActiveFilter('groups')}>
                  {groupHits.length} ryhmää
                </button>

              </div>
            )}

            {showsTagSection && (visibleGroups.length > 0 || visibleTags.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {visibleGroups.map((group) => {
                  const tagParams = group.member_tag_ids.join(',');
                  if (!tagParams) return null;
                  return (
                    <TagChipLink
                      key={`group-${group.group_id}`}
                      href={`/?tags=${tagParams}`}
                      tone="blue"
                      size="md"
                      icon="📚"
                    >
                      <span>{highlightMatch(group.group_name, query)}</span>
                      <span className="text-xs text-blue-700">({group.member_count})</span>
                    </TagChipLink>
                  );
                })}
                {visibleTags.map((tag) => (
                  <TagChipLink
                    key={`tag-${tag.id}`}
                    href={`/?tags=${tag.id}`}
                    size="md"
                    icon={tag.icon || '🏷️'}
                  >
                    <span>{highlightMatch(tag.name, query)}</span>
                  </TagChipLink>
                ))}
              </div>
            )}

            {showsContentSection && visibleContentResults.length === 0 && query ? (
              <p className="text-center text-gray-500 py-8">
                Ei sisältöosumia haulle &quot;{query}&quot;. Kokeile eri hakusanoja.
              </p>
            ) : showsContentSection ? (
              <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 overflow-hidden">
                {visibleContentResults.map((result, index) => (
                  <Link
                    key={`${result.topic_id}-${result.result_type}-${index}`}
                    href={`/topic/${result.topic_id}`}
                    className="block hover:bg-yellow-50 transition"
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-shrink-0 w-8 text-center">
                        <div className="text-2xl">{result.category_icon}</div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {result.result_type === 'topic' ? (
                            <FileText size={14} className="text-yellow-600 flex-shrink-0" />
                          ) : (
                            <MessageSquare size={14} className="text-blue-500 flex-shrink-0" />
                          )}
                          <h3 className="text-lg font-bold text-gray-800 truncate">
                            {highlightMatch(result.topic_title, query)}
                          </h3>
                        </div>

                        {result.content_snippet && (
                          <p className="text-sm text-gray-600 truncate mb-1">
                            {highlightMatch(result.content_snippet, query)}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="text-yellow-600 font-medium">{result.category_name}</span>
                          <span>{result.author_username}</span>
                          <span className={result.result_type === 'topic' ? 'text-yellow-700' : 'text-blue-600'}>
                            {result.result_type === 'topic' ? 'Aihe' : 'Viesti'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold text-gray-700">
                          {formatFinnishRelative(result.last_post_created_at || result.created_at)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : showsTagSection && visibleGroups.length === 0 && visibleTags.length === 0 && query ? (
              <p className="text-center text-gray-500 py-8">
                Ei osumia valitulle suodattimelle.
              </p>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="max-w-6xl mx-auto mt-8 px-4">
        <Card>
          <p className="text-center text-gray-500 py-8">Ladataan...</p>
        </Card>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
