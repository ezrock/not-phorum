'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SearchInput } from '@/components/ui/SearchInput';
import { useAuth } from '@/contexts/AuthContext';
import { highlightMatch } from './highlightMatch';
import { performForumSearch } from './searchService';
import { SearchResultsPanel } from './SearchResultsPanel';
import type { SearchFilter, SearchResult, SearchSortMode, TagGroupHit, TagHit } from './types';

function sortByLastActivity(a: SearchResult, b: SearchResult): number {
  const aTime = new Date(a.last_post_created_at || a.created_at).getTime();
  const bTime = new Date(b.last_post_created_at || b.created_at).getTime();
  return bTime - aTime;
}

function sortByBest(a: SearchResult, b: SearchResult): number {
  if (b.similarity_score !== a.similarity_score) {
    return b.similarity_score - a.similarity_score;
  }
  return sortByLastActivity(a, b);
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { supabase, profile } = useAuth();

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

  const runSearch = useCallback(async (term: string) => {
    setLoading(true);
    setSearchError('');
    const payload = await performForumSearch({
      supabase,
      profile: (profile as { legacy_tag_icons_enabled?: boolean } | null) ?? null,
      term,
    });
    setResults(payload.results);
    setTagHits(payload.tagHits);
    setGroupHits(payload.groupHits);
    setSearchError(payload.error);
    setLoading(false);
  }, [profile, supabase]);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runSearch(query);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

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

  const sorter = sortMode === 'best' ? sortByBest : sortByLastActivity;
  const topicResults = results.filter((result) => result.result_type === 'topic').sort(sorter);
  const postResults = results.filter((result) => result.result_type === 'post').sort(sorter);
  const allContentResults = [...topicResults, ...postResults].sort(sorter);

  const visibleContentResults = activeFilter === 'topics'
    ? topicResults
    : activeFilter === 'posts'
      ? postResults
      : allContentResults;

  const visibleTags = activeFilter === 'groups' ? [] : tagHits;
  const visibleGroups = activeFilter === 'tags' ? [] : groupHits;
  const showsTagSection = activeFilter === 'all' || activeFilter === 'tags' || activeFilter === 'groups';
  const showsContentSection = activeFilter === 'all' || activeFilter === 'topics' || activeFilter === 'posts';

  return (
    <div className="layout-page-shell">
      <div className="mb-6">
        <div className="section-head-row">
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

      <SearchResultsPanel
        query={query}
        loading={loading}
        searchError={searchError}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        topicResults={topicResults}
        postResults={postResults}
        tagHits={tagHits}
        groupHits={groupHits}
        visibleContentResults={visibleContentResults}
        visibleTags={visibleTags}
        visibleGroups={visibleGroups}
        showsTagSection={showsTagSection}
        showsContentSection={showsContentSection}
        highlightMatch={highlightMatch}
      />
    </div>
  );
}

export default function SearchPage() {
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
      <SearchContent />
    </Suspense>
  );
}
