import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { TagChip, type TagChipSize, type TagChipVariant } from '@/components/ui/TagChip';

interface TagChipInputProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon?: ReactNode;
  variant?: TagChipVariant;
  size?: TagChipSize;
  label: ReactNode;
  removeLabel: string;
  onRemove: () => void;
}

export function TagChipInput({
  icon,
  variant = 'topic',
  size = 'md',
  label,
  removeLabel,
  onRemove,
  disabled = false,
  ...buttonProps
}: TagChipInputProps) {
  return (
    <TagChip icon={icon} variant={variant} size={size}>
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-black/10"
        aria-label={removeLabel}
        disabled={disabled}
        {...buttonProps}
      >
        <X size={12} />
      </button>
    </TagChip>
  );
}
