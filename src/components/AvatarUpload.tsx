import { useEffect, useState, type ChangeEvent } from 'react'
import { AVATAR_TYPES, formatBytes, validateAvatar } from '../lib/avatar'
import { crashTest } from '../lib/crashTest'
import Avatar from './Avatar'

type Props = {
  email: string
  avatarUrl: string | null | undefined
  loadError: string | null
  uploadAvatar: (file: File) => Promise<string | null>
}

export default function AvatarUpload({ email, avatarUrl, loadError, uploadAvatar }: Props) {
  crashTest('profile')

  // The chosen file, only ever set once it has passed validation.
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  // A temporary blob: URL, so the image shows before anything is uploaded.
  // Revoked when the file changes or the card unmounts, to free the memory.
  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function choose(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    // Reset the input, so choosing the same file again still fires onChange.
    e.target.value = ''
    if (!picked) return
    const problem = validateAvatar(picked)
    setError(problem)
    setSaved(false)
    setFile(problem ? null : picked)
  }

  async function upload() {
    if (!file) return
    setBusy(true)
    setError(null)
    const problem = await uploadAvatar(file)
    setBusy(false)
    if (problem) {
      setError(`Upload failed: ${problem}`)
    } else {
      setFile(null)
      setSaved(true)
    }
  }

  function cancel() {
    setFile(null)
    setError(null)
  }

  return (
    <section className="card profile" aria-labelledby="profile-title">
      <div className="profile-row">
        <div className="avatar-frame">
          {preview ? (
            <>
              <img
                className="avatar"
                src={preview}
                alt="Preview of your new photo"
                width={72}
                height={72}
                // The type says image, but the contents may not be one.
                onError={() => {
                  setError(`“${file?.name}” couldn’t be read as an image. Choose another file.`)
                  setFile(null)
                }}
              />
              <span className="badge">Preview</span>
            </>
          ) : (
            <Avatar src={avatarUrl} email={email} size={72} alt="Your profile photo" />
          )}
        </div>

        <div className="profile-body">
          <h2 id="profile-title">Profile photo</h2>
          <p className="muted small">
            {file ? `${file.name} · ${formatBytes(file.size)} · not uploaded yet` : 'PNG, JPEG, WebP or GIF, up to 1 MB.'}
          </p>
          <div className="row">
            {file ? (
              <>
                <button onClick={upload} disabled={busy}>
                  {busy ? 'Uploading…' : 'Upload'}
                </button>
                <button className="ghost" onClick={cancel} disabled={busy}>
                  Cancel
                </button>
              </>
            ) : (
              <label className="file-pick">
                {/* accept only filters the file picker; validateAvatar still checks what arrives. */}
                <input type="file" accept={AVATAR_TYPES.join(',')} onChange={choose} />
                {avatarUrl ? 'Change photo' : 'Choose photo'}
              </label>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!error && loadError && <p className="error">Couldn’t load your profile: {loadError}</p>}
      {saved && !file && (
        <p className="notice" role="status">
          Photo saved.
        </p>
      )}
    </section>
  )
}
