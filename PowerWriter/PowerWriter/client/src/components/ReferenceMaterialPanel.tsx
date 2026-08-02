import type { ReferenceMaterialSummary } from "../types";
import { ReferenceFileList } from "./ReferenceFileList";
import { ReferenceUrlInput } from "./ReferenceUrlInput";

type ReferenceMaterialPanelProps = {
  label: string;
  hint: string;
  referenceMaterial?: ReferenceMaterialSummary | null;
  disabled?: boolean;
  uploading?: boolean;
  uploadButtonLabel: string;
  onUploadClick: () => void;
  onAddUrl: (url: string) => Promise<void>;
  onRemoveFile: (filePath: string) => void;
  onRemoveAll?: () => void;
};

export function ReferenceMaterialPanel({
  label,
  hint,
  referenceMaterial,
  disabled = false,
  uploading = false,
  uploadButtonLabel,
  onUploadClick,
  onAddUrl,
  onRemoveFile,
  onRemoveAll
}: ReferenceMaterialPanelProps) {
  const busy = disabled || uploading;
  const files = referenceMaterial?.files ?? [];

  return (
    <div className="document-reference-controls">
      <p className="panel-label document-reference-panel-label">{label}</p>
      <button
        type="button"
        className="ghost document-reference-upload-btn"
        disabled={busy}
        onClick={onUploadClick}
      >
        {uploading ? "Importing…" : uploadButtonLabel}
      </button>
      <ReferenceUrlInput disabled={busy} onAdd={onAddUrl} />
      <ReferenceFileList
        files={files}
        totalChars={referenceMaterial?.totalChars ?? 0}
        disabled={busy}
        onRemove={onRemoveFile}
        onRemoveAll={files.length > 0 ? onRemoveAll : undefined}
      />
      {files.length === 0 ? (
        <p className="document-reference-hint">{hint}</p>
      ) : null}
    </div>
  );
}
