// Avatar file rules. These match the "avatars" bucket's own limits in
// supabase/avatars.sql: checking here gives a friendly message before any
// upload, while the bucket is what really refuses bad files.

export const AVATAR_MAX_BYTES = 1024 * 1024 // 1 MB

// Raster formats every browser can show. No SVG (it can carry scripts) and no
// HEIC (most browsers can't display it).
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

/** Each user's files live in a folder named after their id; the storage policy requires it. */
export function avatarPath(userId: string): string {
  return `${userId}/avatar`
}

/** A message explaining why the file can't be used, or null if it's fine. */
export function validateAvatar(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) {
    return `“${file.name}” isn’t a supported image. Choose a PNG, JPEG, WebP or GIF.`
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return `“${file.name}” is ${formatBytes(file.size)}. Choose an image of 1 MB or less.`
  }
  if (file.size === 0) {
    return `“${file.name}” is empty. Choose another image.`
  }
  return null
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  // Round up, so a file just over the limit never reads as "1.0 MB".
  return `${(Math.ceil((bytes / (1024 * 1024)) * 10) / 10).toFixed(1)} MB`
}
