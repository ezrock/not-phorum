/**
 * Insert Cloudinary transformations into a Cloudinary URL.
 * Works by adding transform params before the upload path segment.
 *
 * Example:
 *   cloudinaryUrl(url, 'w_200,h_200,c_fill,f_auto,q_auto')
 */
export function cloudinaryUrl(url: string, transforms: string): string {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  return url.replace('/upload/', `/upload/${transforms}/`);
}

/** Profile image: small circle (nav, post sidebar) */
export function profileThumb(url: string): string {
  return cloudinaryUrl(url, 'w_80,h_80,c_fill,g_face,f_auto,q_auto');
}

/** Profile image: medium (profile page header) */
export function profileMedium(url: string): string {
  return cloudinaryUrl(url, 'w_200,h_200,c_fill,g_face,f_auto,q_auto');
}

/** Post attachment: responsive, max 800px wide */
export function postImage(url: string): string {
  return cloudinaryUrl(url, 'w_800,c_limit,f_auto,q_auto');
}

/** Post attachment thumbnail (for preview before sending) */
export function postThumb(url: string): string {
  return cloudinaryUrl(url, 'w_300,h_200,c_fill,f_auto,q_auto');
}

export interface CloudinaryUploadResult {
  info?: {
    secure_url?: string;
  };
}

export function extractSecureUrl(result: unknown): string | null {
  const typed = result as CloudinaryUploadResult;
  return typed?.info?.secure_url ?? null;
}
