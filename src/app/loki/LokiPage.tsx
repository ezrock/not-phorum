'use client';

import { useEffect, useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { SearchInput } from '@/components/ui/SearchInput';
import { formatFinnishDateTime } from '@/lib/formatDate';
import { fetchLokiEvents } from './fetchLokiEvents';
import { LokiEventRow } from './LokiEventRow';
import { isLokiFilter } from './lokiUtils';
import type { EventItem, FilterType } from './types';

function filterEvents(events: EventItem[], filter: FilterType, searchQuery: string): EventItem[] {
  const list = filter === 'all' ? events : events.filter((event) => event.type === filter);
  const q = searchQuery.trim().toLowerCase();
  if (!q) return list;
  return list.filter((event) =>
    Boolean(event.author?.username.toLowerCase().includes(q))
    || event.topic_title.toLowerCase().includes(q)
    || Boolean(event.urls?.some((url) => url.toLowerCase().includes(q)))
  );
}

export default function LokiPage() {
  const { supabase } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const syncFilterFromHash = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (isLokiFilter(hash)) {
        setFilter(hash);
      } else if (window.location.hash) {
        setFilter('all');
      }
    };

    syncFilterFromHash();
    window.addEventListener('hashchange', syncFilterFromHash);
    return () => window.removeEventListener('hashchange', syncFilterFromHash);
  }, []);

  useEffect(() => {
    const nextHash = `#${filter}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }, [filter]);

  useEffect(() => {
    const run = async () => {
      const nextEvents = await fetchLokiEvents(supabase);
      setEvents(nextEvents);
      setLoading(false);
    };
    void run();
  }, [supabase]);

  const filtered = useMemo(() => filterEvents(events, filter, searchQuery), [events, filter, searchQuery]);

  if (loading) {
    return (
      <div className="page-container">
        <Card>
          <p className="state-empty-text">Ladataan...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <ScrollText size={28} className="text-gray-800" />
          <h2 className="text-3xl font-bold">Loki</h2>
        </div>
        <p className="text-gray-600 mt-1">
          Yarr! {events.length} tapahtumaa{events.length > 0 && ` — viimeisin ${formatFinnishDateTime(events[0].created_at)}`}
        </p>
      </div>

      <div className="page-tabs mb-4">
        <div className="flex gap-2 flex-wrap">
          {([
            ['all', 'Kaikki'],
            ['image', 'Kuvat'],
            ['video', 'Videot'],
            ['url', 'Linkit'],
            ['quote', 'Lainaukset'],
          ] as [FilterType, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`page-tab-button ${filter === value ? 'is-active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <SearchInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Hae..."
          inputClassName="w-48"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="state-empty-text">
            Ei tapahtumia.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filtered.map((event) => (
              <LokiEventRow key={event.id} event={event} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
