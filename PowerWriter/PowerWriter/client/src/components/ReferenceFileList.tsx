type ReferenceFileEntry = {
  path: string;
  charCount: number;
};

type ReferenceFileListProps = {
  files: ReferenceFileEntry[];
  totalChars?: number;
  disabled?: boolean;
  onRemove: (filePath: string) => void;
  onRemoveAll?: () => void;
};

function formatCharCount(chars: number): string {
  if (chars >= 1000) {
    return `~${Math.round(chars / 1000)}k chars`;
  }
  return `${chars} chars`;
}

function displayReferenceName(path: string): string {
  if (path.startsWith("web/")) {
    return path.replace(/^web\//, "").replace(/\.txt$/, "").replace(/\//g, " › ");
  }
  return path.split("/").pop() || path;
}

export function ReferenceFileList({
  files,
  totalChars = 0,
  disabled = false,
  onRemove,
  onRemoveAll
}: ReferenceFileListProps) {
  return (
    <div className="reference-file-list-wrap">
      <p className="reference-file-list-heading">Reference sources</p>
      {files.length === 0 ? (
        <p className="reference-file-list-empty">No references yet — upload a file or add a URL.</p>
      ) : (
        <ul className="reference-file-list" aria-label="Uploaded reference files">
          {files.map((file) => (
            <li key={file.path} className="reference-file-row">
              <span className="reference-file-name" title={file.path}>
                {displayReferenceName(file.path)}
              </span>
              <span className="reference-file-meta">
                {formatCharCount(file.charCount)}
              </span>
              <button
                type="button"
                className="reference-file-remove"
                disabled={disabled}
                aria-label={`Remove ${file.path}`}
                onClick={() => onRemove(file.path)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && onRemoveAll ? (
        <div className="document-reference-summary">
          <span className="document-reference-meta">
            {files.length} source{files.length === 1 ? "" : "s"} · ~
            {Math.round(totalChars / 1000)}k chars total
          </span>
          <button
            type="button"
            className="ghost document-reference-clear-btn"
            disabled={disabled}
            onClick={onRemoveAll}
          >
            Remove all
          </button>
        </div>
      ) : null}
    </div>
  );
}
