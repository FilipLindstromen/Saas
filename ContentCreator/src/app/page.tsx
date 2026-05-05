"use client";

import { Card, V1Badge } from "@/components/app-shell";
import { WORKFLOW_ACTIONS } from "@/lib/constants";
import { runWorkflowAction } from "@/lib/mock-ai";
import { calcEngagementRate } from "@/lib/scoring";
import { useAppState } from "@/lib/app-state";
import { useMemo, useState } from "react";

export default function DashboardPage() {
  const { data } = useAppState();
  const [workflowOutput, setWorkflowOutput] = useState("");

  const byStage = useMemo(() => {
    const map: Record<string, number> = {};
    data.ideas.forEach((idea) => {
      map[idea.status] = (map[idea.status] ?? 0) + 1;
    });
    return map;
  }, [data.ideas]);

  const bestPlatform = useMemo(() => {
    if (!data.analytics.length) return "No analytics yet";
    const grouped = new Map<string, number>();
    data.analytics.forEach((entry) => grouped.set(entry.platform, (grouped.get(entry.platform) ?? 0) + calcEngagementRate(entry)));
    return [...grouped.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No analytics yet";
  }, [data.analytics]);

  const bestFormat = useMemo(() => {
    if (!data.analytics.length) return "No analytics yet";
    const grouped = new Map<string, number>();
    data.analytics.forEach((entry) => grouped.set(entry.formatUsed, (grouped.get(entry.formatUsed) ?? 0) + calcEngagementRate(entry)));
    return [...grouped.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No analytics yet";
  }, [data.analytics]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <V1Badge />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title={`Total ideas: ${data.ideas.length}`}>Ideas tracked across the full workflow.</Card>
        <Card title={`Scripts ready: ${data.scripts.filter((s) => !s.filmed).length}`}>Items waiting in filming queue.</Card>
        <Card title={`Filmed ready to post: ${data.ideas.filter((i) => i.status === "Filmed").length}`}>Manual posting queue count.</Card>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title={`Posted: ${data.ideas.filter((i) => i.status === "Posted").length}`}>Published items tracked manually.</Card>
        <Card title={`Best platform: ${bestPlatform}`}>Calculated from engagement entries.</Card>
        <Card title={`Best format: ${bestFormat}`}>Top format by engagement rate.</Card>
      </div>
      <Card title="Ideas by stage" subtitle="Move cards in Pipeline to advance stages.">
        <div className="flex flex-wrap gap-2 text-sm">
          {Object.entries(byStage).map(([stage, count]) => (
            <span key={stage} className="cc-badge">{stage}: {count}</span>
          ))}
        </div>
      </Card>
      <Card title="Workflow actions" subtitle="Reusable skill-style actions (mock in v1).">
        <div className="grid gap-3 md:grid-cols-2">
          {WORKFLOW_ACTIONS.map((action) => (
            <div key={action.id} className="cc-panel">
              <p className="font-medium">{action.name}</p>
              <p className="cc-muted mt-1 text-xs">{action.description}</p>
              <p className="cc-muted mt-1 text-xs">Inputs: {action.inputs.join(", ")} | Output: {action.outputFormat}</p>
              <button type="button" className="cc-btn-secondary mt-2 !text-xs" onClick={() => setWorkflowOutput(runWorkflowAction(action))}>Run workflow</button>
            </div>
          ))}
        </div>
        {workflowOutput ? <p className="mt-3 text-sm" style={{ color: "var(--accent)" }}>{workflowOutput}</p> : null}
      </Card>
    </div>
  );
}
