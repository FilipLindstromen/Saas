import { useState } from "react";

type ReferenceUrlInputProps = {
  disabled?: boolean;
  onAdd: (url: string) => Promise<void>;
};

export function ReferenceUrlInput({
  disabled = false,
  onAdd
}: ReferenceUrlInputProps) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed || disabled || busy) return;
    setBusy(true);
    try {
      await onAdd(trimmed);
      setUrl("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="document-reference-url-row">
      <input
        type="url"
        className="document-reference-url-input"
        placeholder="https://example.com/article"
        value={url}
        disabled={disabled || busy}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void handleSubmit();
          }
        }}
      />
      <button
        type="button"
        className="ghost document-reference-url-btn"
        disabled={disabled || busy || !url.trim()}
        onClick={() => void handleSubmit()}
      >
        {busy ? "Fetching…" : "Add URL"}
      </button>
    </div>
  );
}
