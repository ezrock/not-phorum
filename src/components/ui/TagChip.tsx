import { type HTMLAttributes, type ReactNode } from 'react';
import { TagIcon } from '@/components/ui/TagIcon';

export type TagChipTone = 'yellow' | 'blue' | 'gray';
export type TagChipSize = 'xs' | 'sm' | 'md';

interface TagChipClassOptions {
  tone?: TagChipTone;
  size?: TagChipSize;
  clickable?: boolean;
  className?: string;
}

function joinClasses(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function getTagChipClasses({
  tone = 'yellow',
  size = 'sm',
  clickable = false,
  className,
}: TagChipClassOptions) {
  const toneClasses: Record<TagChipTone, string> = {
    yellow: 'border-yellow-300 bg-yellow-50 text-yellow-900',
    blue: 'border-blue-300 bg-blue-50 text-blue-900',
    gray: 'border-gray-300 bg-gray-50 text-gray-800',
  };

  const sizeClasses: Record<TagChipSize, string> = {
    xs: 'px-2 py-0.5 text-xs gap-1',
    sm: 'px-2.5 py-1 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
  };

  return joinClasses(
    'inline-flex items-center rounded-full border',
    toneClasses[tone],
    sizeClasses[size],
    clickable && 'transition hover:opacity-90',
    className
  );
}

interface TagChipProps extends HTMLAttributes<HTMLSpanElement> {
  icon?: ReactNode;
  tone?: TagChipTone;
  size?: TagChipSize;
  children: ReactNode;
}

export function TagChip({ icon, tone = 'yellow', size = 'sm', className, children, ...props }: TagChipProps) {
  return (
    <span className={getTagChipClasses({ tone, size, className })} {...props}>
      {typeof icon === 'string' ? (
        <TagIcon icon={icon} alt="Tag icon" className="inline-block h-4 w-4 object-contain" />
      ) : icon ? (
        <span>{icon}</span>
      ) : null}
      <span>{children}</span>
    </span>
  );
}
