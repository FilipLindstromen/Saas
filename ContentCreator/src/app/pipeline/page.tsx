"use client";

import { Card } from "@/components/app-shell";
import { useAppState } from "@/lib/app-state";
import { PIPELINE_STATUSES } from "@/lib/constants";
import { calcIdeaScore } from "@/lib/scoring";
import { PipelineStatus } from "@/lib/types";

export default function PipelinePage() {
  const { data, updateIdeaStatus } = useAppState();
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Pipeline</h2>
      <div className="grid gap-3 xl:grid-cols-3">
        {PIPELINE_STATUSES.map((status) => (
          <Card key={status} title={status} subtitle={`${data.ideas.filter((i) => i.status === status).length} items`}>
            <div className="space-y-2">
              {data.ideas.filter((i) => i.status === status).map((idea) => (
                <div key={idea.id} className="cc-panel text-xs">
                  <p className="text-sm font-medium">{idea.title}</p>
                  <p className="cc-subtle">
                    {idea.recommendedPlatform} &middot; {idea.suggestedFormat}
                  </p>
                  <p className="cc-muted">
                    Source {idea.selectedSource} &middot; Score {calcIdeaScore(idea)}
                  </p>
                  <select className="cc-select mt-1 w-full" value={idea.status} onChange={(e) => updateIdeaStatus(idea.id, e.target.value as PipelineStatus)}>
                    {PIPELINE_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
