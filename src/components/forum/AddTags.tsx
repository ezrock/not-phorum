'use client';

import { useEffect, useRef, useState } from 'react';
import { TagChipInput } from '@/components/ui/TagChipInput';

export interface TagOption {
  id: number;
  name: string;
  slug: string;
  icon?: string;
  group_label?: string;
  group_order?: number;
  tag_order?: number;
}

interface AddTagsProps {
  selected: TagOption[];
  onChange: (next: TagOption[]) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  featuredOnly?: boolean | null;
  maxSelected?: number;
}

interface TagsApiResponse {
  tags?: TagOption[];
}

export function AddTags({
  selected,
  onChange,
  disabled = false,
  label = 'Tagit',
  placeholder = 'Lisää tageja...',
  featuredOnly = true,
  maxSelected,
}: AddTagsProps) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(false);
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
      try {
        const params = new URLSearchParams();
        params.set('status', 'approved');
        params.set('limit', '100');
        params.set('query', query);
        if (featuredOnly !== null) {
          params.set('featured', String(featuredOnly));
        }

        const res = await fetch(`/api/tags?${params.toString()}`, {
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
  }, [query, selected, disabled, featuredOnly]);

  const addTag = (tag: TagOption) => {
    if (selected.some((item) => item.id === tag.id)) return;
    if (maxSelected === 1) {
      onChange([tag]);
    } else if (typeof maxSelected === 'number' && maxSelected > 1) {
      const next = [...selected, tag];
      onChange(next.slice(-maxSelected));
    } else {
      onChange([...selected, tag]);
    }
    setQuery('');
    setOpen(false);
  };

  const removeTag = (tagId: number) => {
    onChange(selected.filter((tag) => tag.id !== tagId));
  };

  const hasGrouping = options.some((tag) => !!tag.group_label);
  const groupedOptions = options.reduce<Record<string, TagOption[]>>((acc, tag) => {
    const key = tag.group_label || 'Muut tagit';
    if (!acc[key]) acc[key] = [];
    acc[key].push(tag);
    return acc;
  }, {});

  return (
    <div ref={rootRef}>
      <label htmlFor="topic-tags" className="block text-sm font-medium mb-1">
        {label}
      </label>

      <div className="relative">
        <input
          id="topic-tags"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
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
              (hasGrouping
                ? Object.entries(groupedOptions).map(([groupLabel, groupTags]) => (
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
                          <span className="mr-1">{tag.icon || '🏷️'}</span>
                          <span>{tag.name}</span>
                        </button>
                      ))}
                    </div>
                  ))
                : options.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-yellow-50"
                      onClick={() => addTag(tag)}
                      disabled={disabled}
                    >
                      <span className="mr-1">{tag.icon || '🏷️'}</span>
                      <span>{tag.name}</span>
                    </button>
                  )))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {selected.map((tag) => (
          <TagChipInput
            key={tag.id}
            icon={tag.icon || '🏷️'}
            label={tag.name}
            removeLabel={`Poista tagi ${tag.name}`}
            onRemove={() => removeTag(tag.id)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
