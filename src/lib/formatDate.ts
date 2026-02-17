/**
 * Simple Finnish date: "15.2.2026"
 */
export function formatFinnishDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fi-FI', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}

/**
 * Compact post date/time: "15.02.26 13.01"
 */
export function formatPostDateTime(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}.${minutes}`;
}

/**
 * Finnish relative date/time formatter.
 *
 * - "tänään klo 13.01"
 * - "eilen klo 13.01"
 * - "15.2.2026 klo 13.01"
 */
export function formatFinnishDateTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  const time = date.toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);

  if (diffDays === 0) return `tänään klo ${time}`;
  if (diffDays === 1) return `eilen klo ${time}`;

  const dateStr = date.toLocaleDateString('fi-FI', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  return `${dateStr} klo ${time}`;
}

/**
 * Short relative date for topic lists.
 *
 * - "13 min sitten"
 * - "3h sitten"
 * - "eilen 13.01"
 * - "15.2.2026 13.01"
 */
export function formatFinnishRelative(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 60) return `${diffMins} min sitten`;
  if (diffHours < 24) return `${diffHours}h sitten`;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);

  if (diffDays === 1) {
    const time = date.toLocaleTimeString('fi-FI', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `eilen ${time}`;
  }

  const datePart = date.toLocaleDateString('fi-FI', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} ${timePart}`;
}
