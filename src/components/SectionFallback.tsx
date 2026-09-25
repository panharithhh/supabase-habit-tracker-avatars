import type { ReactNode } from 'react'

type Props = {
  title: string
  children: ReactNode
  error: Error
  reset: () => void
  /** Extra buttons next to "Try again". */
  actions?: ReactNode
  className?: string
}

/** The body of an ErrorBoundary fallback: what broke, what's still safe, and a retry. */
export default function SectionFallback({ title, children, error, reset, actions, className = '' }: Props) {
  return (
    <div role="alert" className={`card fallback ${className}`}>
      <div className="fallback-text">
        <h2>{title}</h2>
        <p className="muted">{children}</p>
        {import.meta.env.DEV && <p className="fallback-detail">{error.message}</p>}
      </div>
      <div className="fallback-actions">
        <button onClick={reset}>Try again</button>
        {actions}
      </div>
    </div>
  )
}
