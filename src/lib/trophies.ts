export function trophyLocalIconUrl(iconPath: string | null | undefined): string | null {
  if (!iconPath) return null;
  const filename = iconPath.split('/').pop();
  if (!filename) return null;
  return `/trophies/legacy/${filename}`;
}
