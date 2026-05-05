"use client";

import { Card, V1Badge } from "@/components/app-shell";
import { useAppState } from "@/lib/app-state";

export default function PostPage() {
  const { data, updateIdeaStatus } = useAppState();
  const queue = data.ideas.filter((i) => i.status === "Filmed");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Post Queue</h2>
        <V1Badge />
      </div>
      <Card
        title="Manual posting mode"
        subtitle="No direct publishing in v1. Future integrations: Dropbox, scheduler, IG/TikTok/YouTube/LinkedIn/X/Threads APIs."
      >
        <p className="cc-muted text-sm">Publish manually in v1 and track status here.</p>
      </Card>
      {queue.length === 0 ? (
        <Card title="No filmed items ready">Mark items as filmed first.</Card>
      ) : (
        <div className="space-y-3">
          {queue.map((idea) => {
            const script = data.scripts.find((s) => s.ideaId === idea.id);
            return (
              <Card key={idea.id} title={idea.title}>
                <p className="text-sm">Posting status: {idea.status}</p>
                <p className="cc-muted mt-1 text-xs">Manual notes: post natively per platform best practices.</p>
                <p className="cc-muted mt-2 text-xs">
                  Caption variants: {script?.platformCaptions.map((c) => c.platform).join(", ") || "Generate script for captions"}
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {["TikTok", "Instagram", "YouTube", "LinkedIn", "X", "Threads"].map((label) => (
                    <label key={label} className="cc-subtle text-xs">
                      <input type="checkbox" className="mr-1 align-middle" />
                      {label}
                    </label>
                  ))}
                </div>
                <button type="button" className="cc-btn-primary mt-2 !px-2 !py-1 !text-xs" onClick={() => updateIdeaStatus(idea.id, "Posted")}>
                  Mark as posted
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
