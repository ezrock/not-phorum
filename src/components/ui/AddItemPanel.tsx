import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface AddItemPanelProps {
  triggerLabel: string;
  title: string;
  children: ReactNode;
  cancelLabel?: string;
  className?: string;
  disableClose?: boolean;
  onCancel?: () => void;
}

export function AddItemPanel({
  triggerLabel,
  title,
  children,
  cancelLabel = 'Peruuta',
  className,
  disableClose = false,
  onCancel,
}: AddItemPanelProps) {
  const [open, setOpen] = useState(false);

  const handleCancel = () => {
    onCancel?.();
    setOpen(false);
  };

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
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
