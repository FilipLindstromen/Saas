"use client";

import { useState } from "react";
import { Card, V1Badge } from "@/components/app-shell";
import { useAppState } from "@/lib/app-state";
import { generateCompetitorAnalysis } from "@/lib/mock-ai";
import { CompetitorProfile } from "@/lib/types";

export default function CompetitorAnalysisPage() {
  const { data, saveCompetitor } = useAppState();
  const [form, setForm] = useState<Omit<CompetitorProfile, "id">>({
    creatorName: "",
    platform: "Instagram",
    profileUrl: "",
    niche: "",
    notes: "",
    examplePostUrls: "",
    observedHooks: "",
    observedFormats: "",
    postingFrequency: "",
    topPerformingNotes: "",
  });

  const fields: Array<keyof Omit<CompetitorProfile, "id">> = [
    "creatorName",
    "platform",
    "profileUrl",
    "niche",
    "notes",
    "examplePostUrls",
    "observedHooks",
    "observedFormats",
    "postingFrequency",
    "topPerformingNotes",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Competitor Analysis</h2>
        <V1Badge />
      </div>
      <Card title="Manual competitor profile" subtitle="Instagram and YouTube supported as manual inputs in v1.">
        <div className="grid gap-2 md:grid-cols-2">
          {fields.map((key) => (
            <input key={key} className="cc-input" placeholder={key} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
          ))}
        </div>
        <button
          type="button"
          className="cc-btn-primary mt-2"
          onClick={() => {
            const profile: CompetitorProfile = { id: Math.random().toString(36).slice(2, 10), ...form };
            const analysis = generateCompetitorAnalysis(profile);
            saveCompetitor(profile, analysis);
          }}
        >
          Generate analysis
        </button>
      </Card>
      <div className="space-y-3">
        {data.competitorAnalyses.map((analysis) => (
          <Card key={analysis.id} title={`Analysis ${analysis.competitorProfileId}`}>
            <p>Content pillars: {analysis.contentPillars.join(", ")}</p>
            <p>Hook patterns: {analysis.hookPatterns.join(", ")}</p>
            <p>Format patterns: {analysis.formatPatterns.join(", ")}</p>
            <p className="mt-1">What they do well: {analysis.whatTheyDoWell.join(", ")}</p>
            <p>Gaps I can exploit: {analysis.exploitGaps.join(", ")}</p>
            <p className="cc-muted mt-2 text-xs">Inspired ideas: {analysis.inspiredIdeas.slice(0, 5).join(" | ")}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

