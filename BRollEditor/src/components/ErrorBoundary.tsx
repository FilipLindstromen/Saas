import { Component, type ErrorInfo, type ReactNode } from 'react'
import './ErrorBoundary.css'

type Props = { children: ReactNode }
type State = { error: Error | null }

// A crash here (e.g. a bad value reaching Remotion's <Player>) used to leave the whole window
// silently black, with no way to tell what happened short of digging through the Electron
// launcher's log file. Catch it and show something instead.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('BRollEditor crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Try to continue
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
