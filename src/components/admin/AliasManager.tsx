'use client';

import { TokenInput, type TokenItem } from '@/components/ui/TokenInput';

interface AliasManagerProps {
  label: string;
  placeholder: string;
  aliases: TokenItem[];
  query: string;
  onQueryChange: (value: string) => void;
  onAddAlias: (value: string) => Promise<void> | void;
  onDeleteAlias: (id: number | string) => Promise<void> | void;
  disabled?: boolean;
}

export function AliasManager({
  label,
  placeholder,
  aliases,
  query,
  onQueryChange,
  onAddAlias,
  onDeleteAlias,
  disabled = false,
}: AliasManagerProps) {
  return (
    <TokenInput
      label={label}
      placeholder={placeholder}
      tokens={aliases}
      query={query}
      onQueryChange={onQueryChange}
      onRemoveToken={(id) => {
        void onDeleteAlias(id);
      }}
      onSubmitQuery={async (value) => {
        await onAddAlias(value);
      }}
      submitLabel="Lisää"
      emptyMessage="Kirjoita alias ja paina Enter"
      disabled={disabled}
    />
  );
}
