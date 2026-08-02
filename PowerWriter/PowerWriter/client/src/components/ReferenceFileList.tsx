import type { ReferenceMaterialSummary } from "../types";

type ReferenceFileListProps = {
  referenceMaterial: ReferenceMaterialSummary;
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

export function ReferenceFileList({
  referenceMaterial,
  disabled = false,
  onRemove,
  onRemoveAll
}: ReferenceFileListProps) {
  return (
    <div className="reference-file-list-wrap">
      <ul className="reference-file-list" aria-label="Uploaded reference files">
        {referenceMaterial.files.map((file) => (
          <li key={file.path} className="reference-file-row">
            <span className="reference-file-name" title={file.path}>
              {file.path}
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
              ×
            </button>
          </li>
        ))}
      </ul>
      {onRemoveAll ? (
        <div className="document-reference-summary">
          <span className="document-reference-meta">
            {referenceMaterial.files.length} files · ~
            {Math.round(referenceMaterial.totalChars / 1000)}k chars total
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
