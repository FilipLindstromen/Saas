import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { log } from './utils/logger'
import './index.css'

// Log app initialization
log.info('Application starting', {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
  buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown',
  isProduction: typeof __IS_PRODUCTION__ !== 'undefined' ? __IS_PRODUCTION__ : false,
})

// Global error handler for unhandled errors
window.addEventListener('error', (event) => {
  log.error('Unhandled error', event.error || new Error(event.message), {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  })
})

// Global promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  log.error('Unhandled promise rejection', event.reason, {
    type: 'PromiseRejection',
  })
})

// Render app with error boundary
const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

