import { useState } from 'react'

type Props = {
  /** undefined while loading, null when there's no avatar. */
  src: string | null | undefined
  email: string
  size: number
  alt?: string
}

/** A round avatar that falls back to the email's first letter if there's no image or it fails to load. */
export default function Avatar({ src, email, size, alt = '' }: Props) {
  const [broken, setBroken] = useState<string | null>(null)
  const style = { width: size, height: size, fontSize: size * 0.42 }

  if (src === undefined) return <span className="avatar placeholder" style={style} aria-hidden="true" />

  if (src && src !== broken) {
    return <img className="avatar" src={src} alt={alt} width={size} height={size} onError={() => setBroken(src)} />
  }

  return (
    <span className="avatar initial" style={style} aria-hidden="true">
      {email.charAt(0).toUpperCase() || '?'}
    </span>
  )
}
