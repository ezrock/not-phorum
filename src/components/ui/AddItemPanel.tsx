import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface AddItemPanelProps {
  triggerLabel?: string;
  title: string;
  children: ReactNode;
  cancelLabel?: string;
  className?: string;
  disableClose?: boolean;
  onCancel?: () => void;
  /** Controlled mode: open state managed by parent */
  isOpen?: boolean;
  /** Controlled mode: called when panel should close */
  onClose?: () => void;
}

export function AddItemPanel({
  triggerLabel,
  title,
  children,
  cancelLabel = 'Peruuta',
  className,
  disableClose = false,
  onCancel,
  isOpen: controlledOpen,
  onClose,
}: AddItemPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleCancel = () => {
    onCancel?.();
    if (isControlled) {
      onClose?.();
    } else {
      setInternalOpen(false);
    }
  };

  if (!open) {
    if (isControlled) return null;
    return (
      <Button type="button" variant="outline" onClick={() => setInternalOpen(true)}>
        {triggerLabel}
      </Button>
    );
  }

  return (
    <div className={`rounded border border-gray-200 bg-gray-50 p-3 space-y-2 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-800">{title}</h3>
        <button
          type="button"
          className="admin-compact-btn bg-gray-200 text-gray-700 hover:bg-gray-300"
          onClick={handleCancel}
          disabled={disableClose}
        >
          {cancelLabel}
        </button>
      </div>
      {children}
    </div>
  );
}
