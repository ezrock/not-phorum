import { describe, expect, it } from 'vitest';
import { normalizeJoin } from '@/lib/supabase/normalizeJoin';

describe('normalizeJoin', () => {
  it('returns object values as-is', () => {
    const value = { id: 1, name: 'tag' };
    expect(normalizeJoin(value)).toEqual(value);
  });

  it('returns first item for array joins', () => {
    const value = [{ id: 1 }, { id: 2 }];
    expect(normalizeJoin(value)).toEqual({ id: 1 });
  });

  it('returns null for empty array joins', () => {
    expect(normalizeJoin([] as Array<{ id: number }>)).toBeNull();
  });

  it('returns null for null joins', () => {
    expect(normalizeJoin(null)).toBeNull();
  });
});
