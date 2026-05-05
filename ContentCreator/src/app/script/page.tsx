"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/app-shell";
import { useAppState } from "@/lib/app-state";
import { generateScript } from "@/lib/mock-ai";
import { usePersistedState } from "@/lib/use-persisted-state";

export default function ScriptPage() {
  const { data, saveScript } = useAppState();
  const [ideaId, setIdeaId] = usePersistedState("content-creator:script:ideaId", data.ideas[0]?.id ?? "");
  const idea = useMemo(() => data.ideas.find((i) => i.id === ideaId), [ideaId, data.ideas]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const apiKey = data.apiKeys.openai ?? "";

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Script</h2>
      <Card title="Generate filming card" subtitle="Bullet-point style with platform caption variants (OpenAI).">
        <select className="cc-select w-full" value={ideaId} onChange={(e) => setIdeaId(e.target.value)}>
          {data.ideas.map((i) => (
            <option key={i.id} value={i.id}>
              {i.title}
            </option>
          ))}
        </select>
        {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <button
          type="button"
          className="cc-btn-primary mt-2"
          disabled={!idea || loading || !apiKey}
          onClick={async () => {
            if (!idea) return;
            setError("");
            setLoading(true);
            try {
              const script = await generateScript(idea, data.references, data.brandProfile, apiKey);
              saveScript(script);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Generation failed.");
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Generating…" : "Generate script card"}
        </button>
        {!apiKey ? <p className="cc-muted mt-2 text-xs">Add an OpenAI key in the SaaS hub settings.</p> : null}
      </Card>
      <div className="space-y-3">
        {data.scripts.map((s) => (
          <Card key={s.id} title={data.ideas.find((i) => i.id === s.ideaId)?.title ?? "Script card"}>
            <p className="cc-subtle text-sm">Best hook: {s.bestHookRecommendation}</p>
            <p className="mt-1 text-sm">Talking points: {s.talkingPoints.join(" • ")}</p>
            <p className="mt-1 text-sm">CTA: {s.cta}</p>
            <p className="cc-muted mt-1 text-xs">Caption variants: {s.platformCaptions.map((c) => c.platform).join(", ")}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
