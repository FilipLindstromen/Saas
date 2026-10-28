import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// @ts-ignore - shared module is JS
import { applyTheme, getTheme } from '@shared/theme'
import './index.css'

applyTheme(getTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
