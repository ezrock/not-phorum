import { describe, expect, it } from 'vitest';
import { eventOccursOnDate, getPreferredEventForDate, type RecurringSiteEvent } from '@/lib/siteEvents';

function date(value: string) {
  return new Date(`${value}T12:00:00`);
}

describe('eventOccursOnDate', () => {
  it('matches exact date for non-recurring single-day events', () => {
    const event: RecurringSiteEvent = {
      id: 1,
      event_date: '2026-02-22',
      repeats_yearly: false,
    };

    expect(eventOccursOnDate(event, date('2026-02-22'))).toBe(true);
    expect(eventOccursOnDate(event, date('2026-02-23'))).toBe(false);
  });

  it('matches month-day for yearly recurring single-day events', () => {
    const event: RecurringSiteEvent = {
      id: 2,
      event_date: '2020-05-01',
      repeats_yearly: true,
    };

    expect(eventOccursOnDate(event, date('2026-05-01'))).toBe(true);
    expect(eventOccursOnDate(event, date('2026-05-02'))).toBe(false);
  });

  it('matches fixed date-range when recurrence is disabled', () => {
    const event: RecurringSiteEvent = {
      id: 3,
      event_date: '2026-01-01',
      repeats_yearly: false,
      date_range_enabled: true,
      range_start_date: '2026-02-01',
      range_end_date: '2026-02-10',
    };

    expect(eventOccursOnDate(event, date('2026-01-31'))).toBe(false);
    expect(eventOccursOnDate(event, date('2026-02-01'))).toBe(true);
    expect(eventOccursOnDate(event, date('2026-02-10'))).toBe(true);
    expect(eventOccursOnDate(event, date('2026-02-11'))).toBe(false);
  });

  it('matches yearly wrapping ranges over year-end', () => {
    const event: RecurringSiteEvent = {
      id: 4,
      event_date: '2020-01-01',
      date_range_enabled: true,
      range_start_date: '2020-12-28',
      range_end_date: '2021-01-03',
    };

    expect(eventOccursOnDate(event, date('2026-12-29'))).toBe(true);
    expect(eventOccursOnDate(event, date('2027-01-02'))).toBe(true);
    expect(eventOccursOnDate(event, date('2027-01-10'))).toBe(false);
  });

  it('returns false for malformed range month/day values', () => {
    const event: RecurringSiteEvent = {
      id: 5,
      event_date: '2020-01-01',
      date_range_enabled: true,
      range_start_date: '2020-13-99',
      range_end_date: '2020-01-03',
    };

    expect(eventOccursOnDate(event, date('2026-01-02'))).toBe(false);
  });
});

describe('getPreferredEventForDate', () => {
  it('returns null when no events match', () => {
    const events: RecurringSiteEvent[] = [
      { id: 1, event_date: '2020-02-01', repeats_yearly: true },
    ];
    expect(getPreferredEventForDate(events, date('2026-03-01'))).toBeNull();
  });

  it('prefers single-day events over range events on same day', () => {
    const events: RecurringSiteEvent[] = [
      {
        id: 10,
        event_date: '2020-01-01',
        date_range_enabled: true,
        range_start_date: '2020-12-20',
        range_end_date: '2021-01-10',
      },
      {
        id: 11,
        event_date: '2020-12-25',
        repeats_yearly: true,
        date_range_enabled: false,
      },
    ];

    const picked = getPreferredEventForDate(events, date('2026-12-25'));
    expect(picked?.id).toBe(11);
  });

  it('picks latest id among matching single-day events', () => {
    const events: RecurringSiteEvent[] = [
      { id: 100, event_date: '2020-05-01', repeats_yearly: true },
      { id: 101, event_date: '2020-05-01', repeats_yearly: true },
    ];

    const picked = getPreferredEventForDate(events, date('2026-05-01'));
    expect(picked?.id).toBe(101);
  });
});
