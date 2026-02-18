'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export interface TagOption {
  id: number;
  name: string;
  slug: string;
  group_label?: string;
  group_order?: number;
  tag_order?: number;
}

interface AddTagsProps {
  selected: TagOption[];
  onChange: (next: TagOption[]) => void;
  disabled?: boolean;
  allowCreate?: boolean;
}

interface TagsApiResponse {
  tags?: TagOption[];
}

interface CreateTagResponse {
  tag?: TagOption;
  error?: string;
}

function normalizeInputTagName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function AddTags({ selected, onChange, disabled = false, allowCreate = false }: AddTagsProps) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      if (disabled) return;
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/tags?status=approved&featured=true&limit=100&query=${encodeURIComponent(query)}`, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) {
          setOptions([]);
          return;
        }
        const json = (await res.json()) as TagsApiResponse;
        const next = (json.tags || []).filter((tag) => !selected.some((chosen) => chosen.id === tag.id));
        setOptions(next);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query, selected, disabled]);

  const addTag = (tag: TagOption) => {
    if (selected.some((item) => item.id === tag.id)) return;
    onChange([...selected, tag]);
    setQuery('');
    setOpen(false);
  };

  const removeTag = (tagId: number) => {
    onChange(selected.filter((tag) => tag.id !== tagId));
  };

  const normalizedQuery = normalizeInputTagName(query);
  const hasExactVisibleOption = options.some((tag) => tag.name.toLowerCase() === normalizedQuery.toLowerCase());
  const hasExactSelectedOption = selected.some((tag) => tag.name.toLowerCase() === normalizedQuery.toLowerCase());
  const canCreate = allowCreate && normalizedQuery.length > 0 && !hasExactVisibleOption && !hasExactSelectedOption;
  const groupedOptions = options.reduce<Record<string, TagOption[]>>((acc, tag) => {
    const key = tag.group_label || 'Muut tagit';
    if (!acc[key]) acc[key] = [];
    acc[key].push(tag);
    return acc;
  }, {});

  const handleCreate = async () => {
    if (!canCreate || disabled || creating) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: normalizedQuery }),
      });
      const data = (await res.json()) as CreateTagResponse;
      if (!res.ok || !data.tag) {
        setError(data.error || 'Tagin luonti epäonnistui');
        return;
      }
      addTag(data.tag);
    } catch {
      setError('Tagin luonti epäonnistui');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={rootRef}>
      <label htmlFor="topic-tags" className="block text-sm font-medium mb-1">
        Tagit
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {selected.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full border border-yellow-400 bg-yellow-50 px-3 py-1 text-sm text-yellow-900"
          >
            #{tag.name}
            <button
              type="button"
              onClick={() => removeTag(tag.id)}
              className="rounded-full p-0.5 hover:bg-yellow-200"
              aria-label={`Poista tagi ${tag.name}`}
              disabled={disabled}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <input
          id="topic-tags"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Lisää tageja..."
          className="w-full border-2 border-gray-300 rounded-lg p-3 focus:border-yellow-400 focus:outline-none"
          disabled={disabled}
        />

        {open && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            {loading && <div className="px-3 py-2 text-sm text-gray-500">Haetaan tageja...</div>}
            {!loading && options.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">Ei osumia</div>
            )}
            {!loading &&
              Object.entries(groupedOptions).map(([groupLabel, groupTags]) => (
                <div key={groupLabel}>
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 border-y border-gray-100">
                    {groupLabel}
                  </div>
                  {groupTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-yellow-50"
                      onClick={() => addTag(tag)}
                      disabled={disabled}
                    >
                      #{tag.name}
                    </button>
                  ))}
                </div>
              ))}
            {!loading && canCreate && (
              <button
                type="button"
                className="block w-full border-t border-gray-200 px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50"
                onClick={handleCreate}
                disabled={disabled || creating}
              >
                {creating ? 'Luodaan tagia...' : `Luo uusi tagi: #${normalizedQuery}`}
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
