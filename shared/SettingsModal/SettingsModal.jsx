/**
 * Shared Settings Modal.
 * API keys are configured only in the SaaS Apps screen (docs/index.html).
 * This modal shows a link to that screen and optional app-specific settings via children.
 */
import './SettingsModal.css';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onClose
 * @param {React.ReactNode} [props.children] - App-specific settings (e.g. font picker) rendered after the API keys notice
 * @param {function} [props.onSave] - Called when Save is clicked; use to persist app-specific settings
 */
export default function SettingsModal({ isOpen, onClose, children, onSave }) {
  const saasAppsUrl = typeof window !== 'undefined'
    ? new URL('../index.html', window.location.href).href
    : '/index.html';

  const handleSave = (e) => {
    e?.preventDefault();
    onSave?.();
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="shared-settings-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shared-settings-title"
    >
      <div className="shared-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shared-settings-header">
          <h2 id="shared-settings-title">Settings</h2>
          <button type="button" className="shared-settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={handleSave} className="shared-settings-form">
          <p className="shared-settings-hint">
            API keys (OpenAI, GIPHY, Pexels, Pixabay, Unsplash, Google Client ID) are configured in the{' '}
            <a href={saasAppsUrl} target="_blank" rel="noopener noreferrer" className="shared-settings-link">
              SaaS Apps screen
            </a>
            . They are shared across all apps and stored locally only—never sent to our servers.
          </p>
          {children ? <div className="shared-settings-extra">{children}</div> : null}
          <div className="shared-settings-actions">
            <button type="button" className="shared-settings-btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="shared-settings-btn primary">
              {children ? 'Save' : 'Close'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
