import { useEffect, useState } from 'react'
import { isCanvaClientConfigured, getCanvaRedirectUri } from '../utils/canva/canvaConfig'
import { clearCanvaConnection, getCanvaConnectionSummary, isCanvaConnected, startCanvaOAuthRedirect } from '../utils/canva/canvaAuth'
import './CanvaConnectOverlay.css'

export default function CanvaConnectOverlay({
  isOpen,
  onClose,
  onConnected,
  error,
  onClearError,
  sending,
  sendSuccess,
}) {
  const [connecting, setConnecting] = useState(false)
  const [localError, setLocalError] = useState('')
  const configured = isCanvaClientConfigured()
  const connected = isCanvaConnected()
  const summary = getCanvaConnectionSummary()

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !sending) onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [isOpen, onClose, sending])

  useEffect(() => {
    if (!isOpen) {
      setLocalError('')
      setConnecting(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const displayError = localError || error

  const handleConnect = async () => {
    setLocalError('')
    onClearError?.()
    setConnecting(true)
    try {
      await startCanvaOAuthRedirect()
    } catch (err) {
      setLocalError(err?.message || 'Could not start Canva sign-in.')
      setConnecting(false)
    }
  }

  const handleDisconnect = () => {
    clearCanvaConnection()
    onConnected?.()
  }

  return (
    <>
      <button type="button" className="canva-connect-backdrop" aria-label="Close" onClick={sending ? undefined : onClose} />
      <div className="canva-connect-overlay" role="dialog" aria-labelledby="canva-connect-title">
        <div className="canva-connect-header">
          <h2 id="canva-connect-title">Send to Canva</h2>
          <button type="button" className="canva-connect-close" onClick={onClose} disabled={sending} aria-label="Close">
            ×
          </button>
        </div>
        <div className="canva-connect-body">
          {sendSuccess ? (
            <p className="canva-connect-success">{sendSuccess}</p>
          ) : sending ? (
            <p className="canva-connect-status">Uploading to your Canva library…</p>
          ) : !configured ? (
            <>
              <p>
                Canva Connect is not configured for this build. Add{' '}
                <code>CANVA_CLIENT_ID</code>, <code>CANVA_CLIENT_SECRET</code>, and{' '}
                <code>VITE_CANVA_CLIENT_ID</code> to the repo root <code>.env</code>, then restart dev or rebuild.
              </p>
              <p className="canva-connect-hint">
                Register redirect URI: <code>{getCanvaRedirectUri()}</code>
              </p>
            </>
          ) : connected ? (
            <>
              <p className="canva-connect-lead">Your Canva account is connected.</p>
              {summary?.connectedAt ? (
                <p className="canva-connect-meta">
                  Connected {new Date(summary.connectedAt).toLocaleString()}
                </p>
              ) : null}
              <p className="canva-connect-hint">Click Send to Canva in the top bar to upload the current image.</p>
              <button type="button" className="canva-connect-disconnect" onClick={handleDisconnect}>
                Disconnect Canva
              </button>
            </>
          ) : (
            <>
              <p className="canva-connect-lead">
                Connect Canva to upload your sketch or generated image into your Canva library.
              </p>
              <p className="canva-connect-hint">
                Uses Canva Connect (OAuth). Token exchange runs through this app&apos;s local API proxy with your client secret — not in the browser.
              </p>
              <button type="button" className="canva-connect-primary" onClick={handleConnect} disabled={connecting}>
                {connecting ? 'Redirecting…' : 'Connect to Canva'}
              </button>
            </>
          )}

          {displayError ? <p className="canva-connect-error">{displayError}</p> : null}
        </div>
      </div>
    </>
  )
}
