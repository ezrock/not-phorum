export interface CloudinaryWidgetOptions {
  maxFiles: number;
  resourceType: 'image';
  folder: string;
  cropping?: boolean;
  croppingAspectRatio?: number;
}

export function getCloudinaryUploadPresetOrThrow(): string {
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!preset || preset.trim().length === 0) {
    throw new Error(
      'Cloudinary upload preset puuttuu: aseta NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ympäristömuuttuja.'
    );
  }
  return preset;
}

export function getPostUploadWidgetOptions(): CloudinaryWidgetOptions {
  return {
    maxFiles: 1,
    resourceType: 'image',
    folder: 'freakon/posts',
  };
}

export function getProfileUploadWidgetOptions(): CloudinaryWidgetOptions {
  return {
    maxFiles: 1,
    resourceType: 'image',
    folder: 'freakon/profiles',
    cropping: true,
    croppingAspectRatio: 1,
  };
}
