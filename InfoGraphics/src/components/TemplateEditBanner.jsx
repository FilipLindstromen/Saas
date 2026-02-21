import { useState } from 'react'
import './TemplateEditBanner.css'

export default function TemplateEditBanner({ onSave, onExit, isSaving }) {
  const [showNameInput, setShowNameInput] = useState(false)
  const [name, setName] = useState('')

  const handleSaveClick = () => {
    setShowNameInput(true)
  }

  const handleConfirmSave = (e) => {
    e?.preventDefault()
    if (name.trim()) {
      onSave(name.trim())
      setName('')
      setShowNameInput(false)
    }
  }

  const handleCancel = () => {
    setShowNameInput(false)
    setName('')
  }

  return (
    <div className="template-edit-banner">
      <span className="template-edit-banner-label">Change templates mode – edit the layout, add graphics, then save</span>
      <div className="template-edit-banner-actions">
        {showNameInput ? (
          <form className="template-edit-save-form" onSubmit={handleConfirmSave}>
            <input
              type="text"
              placeholder="Template name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={isSaving}
            />
            <button type="submit" disabled={!name.trim() || isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <button type="button" className="template-edit-save-btn" onClick={handleSaveClick}>
              Save as template
            </button>
            <button type="button" className="template-edit-exit-btn" onClick={onExit}>
              Exit
            </button>
          </>
        )}
      </div>
    </div>
  )
}
