'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Search, MessageSquare, FileText, ArrowLeft } from 'lucide-react';

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
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { supabase } = useAuth();

  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(query);
  const [searchError, setSearchError] = useState('');

  const performSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      setSearchError('');
      return;
    }
    setLoading(true);
    setSearchError('');

    const { data, error } = await supabase.rpc('search_forum', {
      search_term: term.trim(),
      result_limit: 30,
    });

    if (!error && data) {
      setResults(data as SearchResult[]);
    } else {
      setResults([]);
      setSearchError(error?.message || 'Haku epäonnistui');
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void performSearch(query);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [query, performSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed.length >= 2) {
      router.push(`/forum/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  // De-duplicate: keep highest-scoring entry per topic_id
  const deduplicatedResults = results.reduce<SearchResult[]>((acc, result) => {
    const existing = acc.find(r => r.topic_id === result.topic_id);
    if (!existing) {
      acc.push(result);
    } else if (result.similarity_score > existing.similarity_score) {
      const idx = acc.indexOf(existing);
      acc[idx] = result;
    }
    return acc;
  }, []);

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Search size={28} className="text-gray-800" />
          <h2 className="text-3xl font-bold">Haku</h2>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Hae aiheista ja viesteistä..."
            className="flex-1 px-4 py-2 border-2 border-gray-300 rounded focus:border-yellow-400 focus:outline-none"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-bold rounded transition"
          >
            Hae
          </button>
        </form>

        {query && (
          <p className="mt-3 text-sm text-gray-600">
            {loading
              ? 'Haetaan...'
              : `Hakutuloksia haulle "${query}": ${deduplicatedResults.length} osumaa`}
          </p>
        )}
      </div>

      <div className="mb-4">
        <Link href="/forum" className="flex items-center gap-2 text-yellow-600 hover:underline text-sm">
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
      ) : deduplicatedResults.length === 0 && query ? (
        <Card>
          <p className="text-center text-gray-500 py-8">
            Ei hakutuloksia haulle &quot;{query}&quot;. Kokeile eri hakusanoja.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {deduplicatedResults.map((result, index) => (
            <Link key={`${result.topic_id}-${result.result_type}-${index}`} href={`/forum/topic/${result.topic_id}`}>
              <Card className="hover:border-yellow-400 transition cursor-pointer py-3 px-4">
                <div className="flex items-center gap-3">
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
                        {result.topic_title}
                      </h3>
                    </div>

                    {result.content_snippet && (
                      <p className="text-sm text-gray-600 truncate mb-1">
                        {result.content_snippet}
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
                </div>
              </Card>
            </Link>
          ))}
        </div>
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
