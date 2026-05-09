import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
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

  handleReset = () => {
    try {
      localStorage.removeItem('pitchDeckChapters')
      localStorage.removeItem('pitchDeckSlides')
      localStorage.removeItem('pitchDeckSelectedId')
      localStorage.removeItem('pitchDeckCurrentChapterId')
      localStorage.removeItem('pitchDeckMode')
    } catch (error) {
      console.warn('Could not clear PitchDeck storage:', error)
    }
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
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
            <button
              type="button"
              onClick={this.handleReset}
              style={{ background: '#ff6b35', color: '#fff', border: 0, borderRadius: '10px', padding: '10px 16px', cursor: 'pointer', fontWeight: 600 }}
            >
              Reset local PitchDeck data
            </button>
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
