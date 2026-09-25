import { Component, type ErrorInfo, type ReactNode } from 'react'

type FallbackProps = { error: Error; reset: () => void }

type Props = {
  /** Shown in the console, so you can tell which section failed. */
  name: string
  children: ReactNode
  fallback: (props: FallbackProps) => ReactNode
  /** Runs before a retry, to clear whatever caused the error. */
  onReset?: () => void
}

type State = { error: Error | null }

// Catches errors thrown while its children render, so a crash replaces only
// this section with its fallback instead of blanking the whole page.
// Error boundaries only exist as class components. They don't catch errors in
// event handlers or async code: those are handled where they happen, like the
// avatar upload's inline error.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.name}] crashed and was replaced by its fallback:`, error, info.componentStack)
  }

  reset = () => {
    this.props.onReset?.()
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    return error ? this.props.fallback({ error, reset: this.reset }) : this.props.children
  }
}
