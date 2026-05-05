"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/app-shell";
import { useAppState } from "@/lib/app-state";
import { generateVariations } from "@/lib/mock-ai";

export default function MultiplyPage() {
  const { data, setData, saveVariationAsIdea } = useAppState();
  const [ideaId, setIdeaId] = useState(data.ideas[0]?.id ?? "");
  const selectedIdea = useMemo(() => data.ideas.find((i) => i.id === ideaId), [data.ideas, ideaId]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const apiKey = data.apiKeys.openai ?? "";

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Multiply</h2>
      <Card title="Turn one idea into 5 variations">
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
          disabled={!selectedIdea || loading || !apiKey}
          onClick={async () => {
            if (!selectedIdea) return;
            setError("");
            setLoading(true);
            try {
              const next = await generateVariations(selectedIdea, data.brandProfile, apiKey);
              setData((prev) => ({ ...prev, variations: [...next, ...prev.variations] }));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Generation failed.");
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Generating…" : "Generate variations"}
        </button>
        {!apiKey ? <p className="cc-muted mt-2 text-xs">Add an OpenAI key in the SaaS hub settings.</p> : null}
      </Card>
      <Card title={`Variations (${data.variations.length})`}>
        {data.variations.length === 0 ? (
          <p className="cc-muted text-sm">No variations yet.</p>
        ) : (
          <div className="space-y-2">
            {data.variations.map((v) => (
              <div key={v.id} className="cc-panel text-sm">
                <p className="font-medium">{v.title}</p>
                <p>
                  {v.formatType} | target: {v.targetViewer}
                </p>
                <p className="cc-subtle">{v.hookIdea}</p>
                <p className="cc-muted text-xs">
                  Difficulty {v.difficultyScore} • Est. performance {v.estimatedPerformanceScore}
                </p>
                <button type="button" className="cc-btn-secondary mt-2" onClick={() => saveVariationAsIdea(v)}>
                  Save variation to pipeline
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
