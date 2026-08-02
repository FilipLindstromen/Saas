import { useState } from 'react'

function formatCharCount(chars) {
  if (chars >= 1000) return `~${Math.round(chars / 1000)}k chars`
  return `${chars} chars`
}

function displayReferenceName(path) {
  if (path.startsWith('web/')) {
    return path.replace(/^web\//, '').replace(/\.txt$/, '').replace(/\//g, ' › ')
  }
  return path.split('/').pop() || path
}

export default function ConceptReferenceSection({
  manifest,
  files,
  disabled = false,
  uploading = false,
  onUploadFiles,
  onAddUrl,
  onRemoveFile,
  onRemoveAll,
}) {
  const [url, setUrl] = useState('')
  const [urlBusy, setUrlBusy] = useState(false)
  const busy = disabled || uploading || urlBusy
  const listFiles = manifest?.files ?? files.map((f) => ({ path: f.path, charCount: f.text.length }))

  const handleUrlSubmit = async () => {
    const trimmed = url.trim()
    if (!trimmed || busy) return
    setUrlBusy(true)
    try {
      await onAddUrl(trimmed)
      setUrl('')
    } finally {
      setUrlBusy(false)
    }
  }

  return (
    <div className="concept-reference">
      <label className="concept-label">Reference material</label>
      <p className="concept-reference-hint">
        Upload files or add URLs — used when generating carousel copy and A/B variants.
      </p>
      <input
        type="file"
        id="concept-reference-file-input"
        accept=".zip,.pdf,.txt,.md,.markdown,.json,.html,.htm,.yaml,.yml,application/pdf,application/zip,text/plain,text/markdown"
        multiple
        className="concept-reference-file-input"
        disabled={busy}
        onChange={(event) => {
          const list = event.target.files
          event.target.value = ''
          if (list?.length) void onUploadFiles(Array.from(list))
        }}
      />
      <label htmlFor="concept-reference-file-input" className={`concept-btn concept-btn-ghost concept-reference-upload ${busy ? 'disabled' : ''}`}>
        {uploading ? 'Importing…' : listFiles.length ? 'Add reference files' : 'Upload reference files'}
      </label>
      <div className="concept-reference-url-row">
        <input
          type="url"
          className="concept-input concept-reference-url-input"
          placeholder="https://example.com/article"
          value={url}
          disabled={busy}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleUrlSubmit()
            }
          }}
        />
        <button
          type="button"
          className="concept-btn concept-btn-ghost"
          disabled={busy || !url.trim()}
          onClick={() => void handleUrlSubmit()}
        >
          {urlBusy ? 'Fetching…' : 'Add URL'}
        </button>
      </div>
      <p className="concept-reference-list-label">Reference sources</p>
      {listFiles.length === 0 ? (
        <p className="concept-reference-empty">No references yet.</p>
      ) : (
        <ul className="concept-reference-list">
          {listFiles.map((file) => (
            <li key={file.path} className="concept-reference-row">
              <span className="concept-reference-name" title={file.path}>
                {displayReferenceName(file.path)}
              </span>
              <span className="concept-reference-meta">{formatCharCount(file.charCount)}</span>
              <button
                type="button"
                className="concept-reference-remove"
                disabled={busy}
                onClick={() => onRemoveFile(file.path)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {listFiles.length > 0 ? (
        <div className="concept-reference-footer">
          <span className="concept-reference-total">
            {listFiles.length} source{listFiles.length === 1 ? '' : 's'} · ~
            {Math.round((manifest?.totalChars ?? 0) / 1000)}k chars
          </span>
          <button type="button" className="concept-btn concept-btn-ghost concept-reference-clear" disabled={busy} onClick={onRemoveAll}>
            Remove all
          </button>
        </div>
      ) : null}
    </div>
  )
}
