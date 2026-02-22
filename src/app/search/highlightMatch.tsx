import type { ReactNode } from 'react';

export function highlightMatch(text: string, needle: string): ReactNode {
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
}
