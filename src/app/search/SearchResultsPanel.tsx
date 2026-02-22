import { Card } from '@/components/ui/Card';
import { TagChipLink } from '@/components/ui/TagChipLink';
import type { ReactNode } from 'react';
import { SearchResultRow } from './SearchResultRow';
import type { SearchFilter, SearchResult, SearchSortMode, TagGroupHit, TagHit } from './types';

function FilterButtons({
  query,
  activeFilter,
  topicCount,
  postCount,
  tagCount,
  groupCount,
  onFilterChange,
}: {
  query: string;
  activeFilter: SearchFilter;
  topicCount: number;
  postCount: number;
  tagCount: number;
  groupCount: number;
  onFilterChange: (filter: SearchFilter) => void;
}) {
  if (!query) return null;
  const classFor = (filter: SearchFilter) =>
    `text-sm underline underline-offset-2 ${activeFilter === filter ? 'text-yellow-700 font-semibold' : 'text-gray-600 hover:text-yellow-700'}`;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button type="button" className={classFor('all')} onClick={() => onFilterChange('all')}>Kaikki:</button>
      <button type="button" className={classFor('topics')} onClick={() => onFilterChange('topics')}>{topicCount} lankaa</button>
      <button type="button" className={classFor('posts')} onClick={() => onFilterChange('posts')}>{postCount} viestiä</button>
      <button type="button" className={classFor('tags')} onClick={() => onFilterChange('tags')}>{tagCount} aihetta</button>
      <button type="button" className={classFor('groups')} onClick={() => onFilterChange('groups')}>{groupCount} ryhmää</button>
    </div>
  );
}

export function SearchResultsPanel({
  query,
  loading,
  searchError,
  sortMode,
  onSortModeChange,
  activeFilter,
  onFilterChange,
  topicResults,
  postResults,
  tagHits,
  groupHits,
  visibleContentResults,
  visibleTags,
  visibleGroups,
  showsTagSection,
  showsContentSection,
  highlightMatch,
}: {
  query: string;
  loading: boolean;
  searchError: string;
  sortMode: SearchSortMode;
  onSortModeChange: (mode: SearchSortMode) => void;
  activeFilter: SearchFilter;
  onFilterChange: (filter: SearchFilter) => void;
  topicResults: SearchResult[];
  postResults: SearchResult[];
  tagHits: TagHit[];
  groupHits: TagGroupHit[];
  visibleContentResults: SearchResult[];
  visibleTags: TagHit[];
  visibleGroups: TagGroupHit[];
  showsTagSection: boolean;
  showsContentSection: boolean;
  highlightMatch: (text: string, needle: string) => ReactNode;
}) {
  if (loading) {
    return (
      <Card>
        <p className="state-empty-text">Haetaan tuloksia...</p>
      </Card>
    );
  }

  if (searchError) {
    return (
      <Card>
        <p className="state-empty-text text-red-600">
          Haku epäonnistui: {searchError}
        </p>
      </Card>
    );
  }

  const noTagMatches = visibleGroups.length === 0 && visibleTags.length === 0;
  const noContentMatches = visibleContentResults.length === 0;

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-800">Hakutulokset</h3>
          <div className="inline-flex items-center rounded-md border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => onSortModeChange('latest')}
              className={`px-3 py-1 text-xs font-medium transition ${
                sortMode === 'latest' ? 'bg-yellow-100 text-yellow-800' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Uusimmat
            </button>
            <button
              type="button"
              onClick={() => onSortModeChange('best')}
              className={`px-3 py-1 text-xs font-medium transition border-l border-gray-300 ${
                sortMode === 'best' ? 'bg-yellow-100 text-yellow-800' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Parhaat
            </button>
          </div>
        </div>

        <FilterButtons
          query={query}
          activeFilter={activeFilter}
          topicCount={topicResults.length}
          postCount={postResults.length}
          tagCount={tagHits.length}
          groupCount={groupHits.length}
          onFilterChange={onFilterChange}
        />

        {showsTagSection && !noTagMatches && (
          <div className="flex flex-wrap gap-2">
            {visibleGroups.map((group) => {
              const tagParams = group.member_tag_ids.join(',');
              if (!tagParams) return null;
              return (
                <TagChipLink
                  key={`group-${group.group_id}`}
                  href={`/?tags=${tagParams}`}
                  variant="group"
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

        {showsContentSection && noContentMatches && query ? (
          <p className="state-empty-text">
            Ei sisältöosumia haulle &quot;{query}&quot;. Kokeile eri hakusanoja.
          </p>
        ) : showsContentSection ? (
          <div className="list-surface">
            {visibleContentResults.map((result, index) => (
              <SearchResultRow
                key={`${result.topic_id}-${result.result_type}-${index}`}
                result={result}
                query={query}
                highlight={highlightMatch}
              />
            ))}
          </div>
        ) : showsTagSection && noTagMatches && query ? (
          <p className="state-empty-text">
            Ei osumia valitulle suodattimelle.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
