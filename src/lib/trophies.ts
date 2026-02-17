export interface Trophy {
  id: number;
  code: string;
  name: string;
  points: number;
  icon_path: string | null;
}

export interface TrophyJoinRow {
  trophy: Trophy | Trophy[] | null;
}

export function trophyLocalIconUrl(iconPath: string | null | undefined): string | null {
  if (!iconPath) return null;
  const filename = iconPath.split('/').pop();
  if (!filename) return null;
  return `/trophies/legacy/${filename}`;
}

/**
 * Parse Supabase trophy join rows into a sorted Trophy array.
 * Handles both single-object and array join shapes.
 */
export function parseTrophies(rows: TrophyJoinRow[]): Trophy[] {
  return rows
    .map((row) => (Array.isArray(row.trophy) ? row.trophy[0] : row.trophy))
    .filter((trophy): trophy is Trophy => Boolean(trophy))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}
