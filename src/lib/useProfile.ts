import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { avatarPath } from './avatar'

/** avatarUrl is undefined while loading and null when the user has no avatar. */
export function useProfile(userId: string) {
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  // Read on mount, so a fresh load shows the avatar saved in the database.
  useEffect(() => {
    let ignore = false
    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (ignore) return
        if (error) setError(error.message)
        setAvatarUrl(data?.avatar_url ?? null)
      })
    return () => {
      ignore = true
    }
  }, [userId])

  /** Uploads the file and saves its URL. Returns an error message, or null on success. */
  async function uploadAvatar(file: File): Promise<string | null> {
    const bucket = supabase.storage.from('avatars')
    const path = avatarPath(userId)

    // upsert: true replaces the previous avatar instead of failing because
    // the path is taken.
    const upload = await bucket.upload(path, file, { upsert: true, contentType: file.type })
    if (upload.error) return upload.error.message

    // Same path on every upload, so add a version to get past cached copies.
    const url = `${bucket.getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
    const save = await supabase.from('profiles').upsert({ id: userId, avatar_url: url })
    if (save.error) return save.error.message

    setError(null)
    setAvatarUrl(url)
    return null
  }

  return { avatarUrl, error, uploadAvatar }
}
