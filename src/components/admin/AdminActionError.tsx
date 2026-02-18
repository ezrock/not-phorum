'use client';

interface AdminActionErrorProps {
  message: string;
  className?: string;
}

export function AdminActionError({ message, className = '' }: AdminActionErrorProps) {
  if (!message.trim()) return null;

  return (
    <p className={`rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 ${className}`}>
      {message}
    </p>
  );
}
