export interface RecurringSiteEvent {
  id: number;
  event_date: string;
  repeats_yearly?: boolean;
  date_range_enabled?: boolean;
  range_start_date?: string | null;
  range_end_date?: string | null;
}

function getMonthDayFromIsoDate(value: string | null | undefined): number | null {
  if (!value || value.length < 10) return null;
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (!Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return month * 100 + day;
}

function getMonthDayFromDate(date: Date): number {
  return (date.getMonth() + 1) * 100 + date.getDate();
}

function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function eventOccursOnDate(event: RecurringSiteEvent, targetDate: Date): boolean {
  const targetMonthDay = getMonthDayFromDate(targetDate);
  const targetIso = toIsoDateLocal(targetDate);
  const repeatsYearly = event.repeats_yearly !== false;

  if (event.date_range_enabled) {
    if (!event.range_start_date || !event.range_end_date) return false;

    if (!repeatsYearly) {
      return targetIso >= event.range_start_date && targetIso <= event.range_end_date;
    }

    const start = getMonthDayFromIsoDate(event.range_start_date);
    const end = getMonthDayFromIsoDate(event.range_end_date);
    if (start === null || end === null) return false;

    // Recurring annual range. If start > end, the range wraps year-end.
    if (start <= end) {
      return targetMonthDay >= start && targetMonthDay <= end;
    }
    return targetMonthDay >= start || targetMonthDay <= end;
  }

  if (!repeatsYearly) {
    return event.event_date === targetIso;
  }

  const singleDay = getMonthDayFromIsoDate(event.event_date);
  return singleDay !== null && singleDay === targetMonthDay;
}

export function getPreferredEventForDate<T extends RecurringSiteEvent>(
  events: T[],
  targetDate: Date
): T | null {
  const matches = events.filter((event) => eventOccursOnDate(event, targetDate));
  if (matches.length === 0) return null;

  const singleDayMatches = matches.filter((event) => !event.date_range_enabled);
  const pool = singleDayMatches.length > 0 ? singleDayMatches : matches;

  return [...pool].sort((a, b) => b.id - a.id)[0] ?? null;
}
