"use client";

import { useState } from "react";
import { Card, V1Badge } from "@/components/app-shell";
import { useAppState } from "@/lib/app-state";
import { RESEARCH_SOURCES } from "@/lib/constants";
import { generateResearchIdeas } from "@/lib/mock-ai";
import { ContentIdea, Platform } from "@/lib/types";

const platforms: Platform[] = ["LinkedIn", "Instagram", "YouTube Shorts", "TikTok", "X", "Threads"];

export default function ResearchPage() {
  const { data, addIdeas } = useAppState();
  const [topic, setTopic] = useState("AI-assisted content systems");
  const [audience, setAudience] = useState("Coaches and creator-educators");
  const [trendNotes, setTrendNotes] = useState("");
  const [count, setCount] = useState(10);
  const [selectedSources, setSelectedSources] = useState(RESEARCH_SOURCES.slice(0, 4));
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(platforms);
  const [results, setResults] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiKey = data.apiKeys.openai ?? "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Research</h2>
        <V1Badge />
      </div>
      <Card
        title="Research Inputs"
        subtitle="Source chips are thematic hints only. OpenAI synthesizes angles from your brief (not live social APIs)."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <input className="cc-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic or niche" />
          <input className="cc-input" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Target audience" />
          <input className="cc-input" value={trendNotes} onChange={(e) => setTrendNotes(e.target.value)} placeholder="Optional trend notes" />
          <input type="number" className="cc-input" value={count} onChange={(e) => setCount(Number(e.target.value))} min={1} max={20} />
        </div>
        <p className="cc-muted mt-3 text-xs">Sources</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {RESEARCH_SOURCES.map((s) => (
            <button type="button" key={s} className="cc-chip" data-active={selectedSources.includes(s) ? "true" : "false"} onClick={() => setSelectedSources((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))}>
              {s}
            </button>
          ))}
        </div>
        <p className="cc-muted mt-3 text-xs">Platforms</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {platforms.map((p) => (
            <button type="button" key={p} className="cc-chip" data-active={selectedPlatforms.includes(p) ? "true" : "false"} onClick={() => setSelectedPlatforms((v) => (v.includes(p) ? v.filter((x) => x !== p) : [...v, p]))}>
              {p}
            </button>
          ))}
        </div>
        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <button
          type="button"
          className="cc-btn-primary mt-4"
          disabled={loading || !apiKey}
          onClick={async () => {
            setError("");
            setLoading(true);
            try {
              const ideas = await generateResearchIdeas({ topic, audience, platforms: selectedPlatforms, selectedSources, trendNotes, count }, data.brandProfile, apiKey);
              setResults(ideas);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Generation failed.");
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Generating…" : "Generate opportunities"}
        </button>
        {!apiKey ? <p className="cc-muted mt-2 text-xs">Add an OpenAI key in the SaaS hub settings to generate.</p> : null}
      </Card>
      <Card title={`Results (${results.length})`} subtitle="Save selected ideas into pipeline.">
        {results.length === 0 ? (
          <p className="cc-muted text-sm">No results yet.</p>
        ) : (
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.id} className="cc-panel text-sm">
                <p className="font-medium">{r.title}</p>
                <p className="cc-subtle">{r.whyTrending}</p>
                <p className="cc-muted text-xs">
                  Source: {r.selectedSource} | Scores: A{r.audienceSizeScore}/D{r.demoAbilityScore}/H{r.hookPotentialScore}
                </p>
                <button type="button" className="cc-btn-secondary mt-2" onClick={() => addIdeas([r])}>
                  Save to pipeline
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
