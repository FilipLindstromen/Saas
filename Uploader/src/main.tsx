import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Apply stored theme before render to avoid flash
const stored = localStorage.getItem('saas-apps-theme')
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
const theme = stored === 'light' || stored === 'dark' ? stored : (prefersDark ? 'dark' : 'dark')
document.documentElement.setAttribute('data-theme', theme)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
