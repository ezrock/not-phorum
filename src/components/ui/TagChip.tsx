import { type HTMLAttributes, type ReactNode } from 'react';
import { TagIcon } from '@/components/ui/TagIcon';

export type TagChipVariant = 'topic' | 'group';
export type TagChipSize = 'xs' | 'sm' | 'md';

interface TagChipClassOptions {
  variant?: TagChipVariant;
  size?: TagChipSize;
  clickable?: boolean;
  className?: string;
}

function joinClasses(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function getTagChipClasses({
  variant = 'topic',
  size = 'sm',
  clickable = false,
  className,
}: TagChipClassOptions) {
  const variantClasses: Record<TagChipVariant, string> = {
    topic: 'border-gray-300 bg-[var(--ref-color-neutral-100)] text-gray-800',
    group: 'border-blue-300 bg-blue-50 text-blue-900',
  };

  const sizeClasses: Record<TagChipSize, string> = {
    xs: 'px-2 py-0.5 text-xs gap-1',
    sm: 'px-2.5 py-1 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
  };

  return joinClasses(
    'inline-flex items-center rounded-full border',
    variantClasses[variant],
    sizeClasses[size],
    clickable && 'transition hover:opacity-90',
    className
  );
}

interface TagChipProps extends HTMLAttributes<HTMLSpanElement> {
  icon?: ReactNode;
  count?: ReactNode;
  variant?: TagChipVariant;
  size?: TagChipSize;
  children: ReactNode;
}

export function TagChip({
  icon,
  count,
  variant = 'topic',
  size = 'sm',
  className,
  children,
  ...props
}: TagChipProps) {
  return (
    <span className={getTagChipClasses({ variant, size, className })} {...props}>
      {typeof icon === 'string' ? (
        <TagIcon icon={icon} alt="Tag icon" className="inline-block h-4 w-4 object-contain" />
      ) : icon ? (
        <span>{icon}</span>
      ) : null}
      <span className="min-w-0 truncate">{children}</span>
      {count !== undefined && count !== null ? (
        <span className="ml-auto shrink-0 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none">
          {count}
        </span>
      ) : null}
    </span>
  );
}
