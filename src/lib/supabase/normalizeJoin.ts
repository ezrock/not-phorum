export type SupabaseJoinField<T> = T | T[] | null;

export function normalizeJoin<T>(value: SupabaseJoinField<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}
