import React from 'react'
import ReactDOM from 'react-dom/client'
import { clearAllPitchDeckProjectData } from './clearPitchDeckBrowserState'
import App from './App'
import './index.css'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '', clearing: false }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unknown render error',
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('PitchDeck render crashed:', error, errorInfo)
  }

  handleReset = async () => {
    this.setState({ clearing: true })
    try {
      await clearAllPitchDeckProjectData()
    } catch (error) {
      console.warn('Could not clear PitchDeck storage:', error)
    }
    window.location.reload()
  }

  handleNuclearReset = async () => {
    if (
      !window.confirm(
        'Delete ALL PitchDeck projects and workspace data from this browser? API keys in the shared hub store are not removed. This cannot be undone.',
      )
    ) {
      return
    }
    this.setState({ clearing: true })
    try {
      await clearAllPitchDeckProjectData()
    } catch (error) {
      console.warn('Could not clear PitchDeck storage:', error)
    }
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const busy = this.state.clearing
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0b0b0b', color: '#fff', padding: '24px' }}>
          <div style={{ maxWidth: '560px', textAlign: 'center' }}>
            <h1 style={{ margin: '0 0 12px', fontSize: '24px' }}>PitchDeck failed to load</h1>
            <p style={{ margin: '0 0 18px', opacity: 0.85 }}>
              A saved local project state appears corrupted and crashed startup.
            </p>
            <p style={{ margin: '0 0 18px', opacity: 0.7, fontSize: '14px' }}>
              Error: {this.state.message}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void this.handleReset()}
                style={{
                  background: '#ff6b35',
                  color: '#fff',
                  border: 0,
                  borderRadius: '10px',
                  padding: '10px 16px',
                  cursor: busy ? 'wait' : 'pointer',
                  fontWeight: 600,
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? 'Clearing…' : 'Reset saved projects'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void this.handleNuclearReset()}
                style={{
                  background: '#2d2d2d',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  cursor: busy ? 'wait' : 'pointer',
                  fontWeight: 600,
                  opacity: busy ? 0.7 : 1,
                }}
              >
                Delete all projects (confirm)
              </button>
            </div>
            <p style={{ margin: '20px 0 0', opacity: 0.55, fontSize: '12px', lineHeight: 1.45 }}>
              If buttons do nothing, open this app with{' '}
              <code style={{ color: '#ccc' }}>?pitchDeckEmergencyReset=1</code> in the URL (runs before the app loads), then reload once.
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
)
