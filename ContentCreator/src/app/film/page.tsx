"use client";

import { useState } from "react";
import { Card } from "@/components/app-shell";
import { useAppState } from "@/lib/app-state";

export default function FilmPage() {
  const { data, setData, updateIdeaStatus } = useAppState();
  const [focusScriptId, setFocusScriptId] = useState<string | null>(null);
  const focus = data.scripts.find((s) => s.id === focusScriptId);

  if (focus) {
    return (
      <div className="space-y-4">
        <button type="button" className="cc-btn-secondary !px-3 !py-2 !text-sm" onClick={() => setFocusScriptId(null)}>
          Exit focus mode
        </button>
        <div
          className="rounded-xl border p-8"
          style={{
            borderColor: "var(--border-default)",
            background: "var(--bg-secondary)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <p className="cc-muted text-sm uppercase">Focus mode</p>
          <h2 className="mt-2 text-3xl font-semibold">{focus.bestHookRecommendation}</h2>
          <ul className="mt-5 list-disc space-y-3 pl-5 text-lg">
            {focus.talkingPoints.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-6 font-medium" style={{ color: "var(--accent)" }}>
            CTA: {focus.cta}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Film Queue</h2>
      {data.scripts.length === 0 ? (
        <Card title="No scripted content yet">Generate scripts first.</Card>
      ) : (
        <div className="space-y-3">
          {data.scripts.map((script) => (
            <Card key={script.id} title={data.ideas.find((i) => i.id === script.ideaId)?.title ?? "Untitled"}>
              <p>Hook: {script.bestHookRecommendation}</p>
              <p className="cc-subtle text-sm">Talking points: {script.talkingPoints.join(" · ")}</p>
              <p className="cc-subtle text-sm">
                Platform: {script.platform} | Format: {script.format}
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" className="cc-btn-secondary" onClick={() => setFocusScriptId(script.id)}>
                  Focus mode
                </button>
                <button
                  type="button"
                  className="cc-btn-primary !px-2 !py-1 !text-xs"
                  onClick={() => {
                    setData((prev) => ({
                      ...prev,
                      scripts: prev.scripts.map((s) => (s.id === script.id ? { ...s, filmed: true } : s)),
                    }));
                    updateIdeaStatus(script.ideaId, "Filmed");
                  }}
                >
                  Mark as filmed
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
