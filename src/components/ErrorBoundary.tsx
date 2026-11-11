import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  resetKey?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FitPro render error', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    const message = this.state.error.message || 'Unknown error'

    return (
      <div className="mesh grid min-h-screen place-items-center px-4 py-12">
        <div className="card w-full max-w-lg p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime">FitPro</p>
          <h1 className="font-display mt-2 text-2xl font-semibold">This screen hit a problem</h1>
          <p className="mt-2 text-sm text-mist">
            The page did not crash the whole app. Reload, or go back to the home page.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-black/30 p-3 text-xs text-ember">{message}</pre>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              className="btn-lime inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
            <a
              href="/"
              className="inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm font-semibold"
            >
              Go home
            </a>
            <button
              className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-mist hover:text-inherit"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}
