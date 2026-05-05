"use client";

import { useState } from "react";
import { Card, V1Badge } from "@/components/app-shell";
import { useAppState } from "@/lib/app-state";
import { SavedVideoReference } from "@/lib/types";

export default function VideoDownloaderPage() {
  const { data, saveVideoReference } = useAppState();
  const [form, setForm] = useState<Omit<SavedVideoReference, "id" | "createdAt">>({
    url: "",
    platform: "",
    creator: "",
    whySaved: "",
    hookNotes: "",
    formatNotes: "",
    transcriptPlaceholder: "",
    tags: "",
  });
  const fields: Array<keyof Omit<SavedVideoReference, "id" | "createdAt">> = [
    "url",
    "platform",
    "creator",
    "whySaved",
    "hookNotes",
    "formatNotes",
    "transcriptPlaceholder",
    "tags",
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Video Downloader</h2>
        <V1Badge />
      </div>
      <Card title="URL saver only" subtitle="Downloading videos may be restricted by platform terms. This v1 stores URLs and notes only.">
        <div className="grid gap-2 md:grid-cols-2">
          {fields.map((key) => (
            <input key={key} className="cc-input" placeholder={key} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
          ))}
        </div>
        <button type="button" className="cc-btn-primary mt-2" onClick={() => saveVideoReference({ id: Math.random().toString(36).slice(2, 10), ...form, createdAt: new Date().toISOString() })}>
          Save reference
        </button>
      </Card>
      <div className="space-y-2">
        {data.videoReferences.map((v) => (
          <Card key={v.id} title={v.creator || v.url}>
            <p className="text-sm">{v.url}</p>
            <p className="cc-subtle text-xs">
              {v.platform} &middot; {v.tags}
            </p>
            <p className="cc-muted text-xs">{v.whySaved}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
