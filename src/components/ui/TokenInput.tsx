'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

export interface TokenItem {
  id: number | string;
  label: string;
  icon?: string;
}

export interface TokenOption {
  id: number | string;
  label: string;
  icon?: string;
  meta?: string;
}

interface TokenInputProps {
  label: string;
  placeholder?: string;
  tokens: TokenItem[];
  query: string;
  onQueryChange: (value: string) => void;
  onRemoveToken: (id: number | string) => void;
  options?: TokenOption[];
  onSelectOption?: (option: TokenOption) => void;
  onSubmitQuery?: (value: string) => void | Promise<void>;
  submitLabel?: string;
  loading?: boolean;
  emptyMessage?: string;
  disabled?: boolean;
}

export function TokenInput({
  label,
  placeholder = '',
  tokens,
  query,
  onQueryChange,
  onRemoveToken,
  options = [],
  onSelectOption,
  onSubmitQuery,
  submitLabel = 'Lisää',
  loading = false,
  emptyMessage = 'Ei osumia',
  disabled = false,
}: TokenInputProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const normalizedQuery = query.trim();

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

  const canSubmitQuery = useMemo(
    () => !!onSubmitQuery && normalizedQuery.length > 0 && !disabled,
    [onSubmitQuery, normalizedQuery, disabled]
  );

  const visibleOptions = useMemo(() => options.slice(0, 8), [options]);

  const handleSubmitQuery = () => {
    if (!canSubmitQuery || !onSubmitQuery) return;
    void onSubmitQuery(normalizedQuery);
  };

  return (
    <div ref={rootRef}>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-2 py-2 focus-within:border-yellow-400">
          {tokens.map((token) => (
            <span
              key={token.id}
              className="inline-flex items-center gap-1 rounded-full border border-yellow-300 bg-yellow-50 px-2 py-0.5 text-xs text-yellow-900"
            >
              {token.icon && <span>{token.icon}</span>}
              <span>{token.label}</span>
              <button
                type="button"
                className="rounded p-0.5 hover:bg-yellow-100"
                onClick={() => onRemoveToken(token.id)}
                disabled={disabled}
                aria-label={`Poista ${token.label}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}

          <input
            value={query}
            onChange={(e) => {
              onQueryChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && query.length === 0 && tokens.length > 0) {
                onRemoveToken(tokens[tokens.length - 1].id);
                return;
              }

              if (e.key === 'Enter') {
                e.preventDefault();
                if (visibleOptions.length > 0 && onSelectOption) {
                  onSelectOption(visibleOptions[0]);
                  return;
                }
                if (canSubmitQuery) {
                  handleSubmitQuery();
                }
              }
            }}
            placeholder={placeholder}
            className="min-w-[180px] flex-1 border-0 bg-transparent p-1 text-sm outline-none focus:border-0 focus:outline-none"
            disabled={disabled}
          />

          {canSubmitQuery && (
            <button
              type="button"
              className="inline-flex items-center rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={handleSubmitQuery}
              disabled={disabled}
            >
              {submitLabel}
            </button>
          )}
        </div>

        {open && onSelectOption && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            {loading && <div className="px-3 py-2 text-sm text-gray-500">Haetaan...</div>}
            {!loading && visibleOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</div>
            )}
            {!loading &&
              visibleOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-yellow-50"
                  onClick={() => onSelectOption(option)}
                  disabled={disabled}
                >
                  <span className="mr-1">{option.icon || ''}</span>
                  <span>{option.label}</span>
                  {option.meta && <span className="ml-1 text-xs text-gray-500">{option.meta}</span>}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
