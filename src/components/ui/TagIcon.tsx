import type { CSSProperties } from 'react';

interface TagIconProps {
  icon?: string | null;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}

function isImagePath(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('/') || normalized.startsWith('http://') || normalized.startsWith('https://');
}

export function TagIcon({ icon, alt = 'Tag icon', className, style }: TagIconProps) {
  const normalized = (icon || '').trim();

  if (normalized && isImagePath(normalized)) {
    return <img src={normalized} alt={alt} className={className} style={style} />;
  }

  return (
    <span className={className} style={style} aria-label={alt}>
      {normalized || '🏷️'}
    </span>
  );
}
