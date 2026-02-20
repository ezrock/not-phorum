import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import Link, { type LinkProps } from 'next/link';
import { getTagChipClasses, type TagChipSize, type TagChipTone } from '@/components/ui/TagChip';

interface TagChipLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>, LinkProps {
  icon?: ReactNode;
  tone?: TagChipTone;
  size?: TagChipSize;
  children: ReactNode;
}

export function TagChipLink({
  href,
  icon,
  tone = 'yellow',
  size = 'sm',
  className,
  children,
  ...props
}: TagChipLinkProps) {
  return (
    <Link
      href={href}
      className={getTagChipClasses({ tone, size, clickable: true, className: `hover:bg-opacity-80 ${className || ''}` })}
      {...props}
    >
      {icon ? <span>{icon}</span> : null}
      <span>{children}</span>
    </Link>
  );
}
