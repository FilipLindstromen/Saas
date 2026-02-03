import './AppLogo.css'

function AppLogo({ className = '', ...props }) {
  return (
    <span className={`app-logo ${className}`.trim()} {...props}>
      <svg className="app-logo-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <rect x="4" y="6" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <rect x="8" y="10" width="10" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.8" />
        <path d="M22 10h4l2 2v6l-2 2h-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
      </svg>
      <span className="app-logo-text">
        <span className="app-logo-wordmark">Pitch Deck</span>
        <span className="app-logo-year">2000</span>
      </span>
    </span>
  )
}

export default AppLogo
