import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Builder Error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 p-6 shadow-2xl border border-rose-500/30">
            <h2 className="mb-3 text-lg font-bold text-rose-400">⚠ Builder Error</h2>
            <p className="mb-3 text-sm text-zinc-300 break-all">{this.state.error.message}</p>
            <pre className="mb-4 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-rose-300">
{this.state.error.stack}
            </pre>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-full bg-lime px-4 py-2 text-sm font-bold text-black hover:bg-lime-600"
            >
              Dismiss
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
