"use client";

import { Card, V1Badge } from "@/components/app-shell";
import { WORKFLOW_ACTIONS } from "@/lib/constants";
import { runWorkflowAction } from "@/lib/mock-ai";
import { calcEngagementRate } from "@/lib/scoring";
import { useAppState } from "@/lib/app-state";
import { usePersistedState } from "@/lib/use-persisted-state";
import { ReactNode, useMemo, useState } from "react";

type StoredWorkflowResult = {
  actionId: string;
  actionName: string;
  output: string;
  updatedAt: string;
};

export default function DashboardPage() {
  const { data } = useAppState();
  const [workflowError, setWorkflowError] = useState("");
  const [workflowLoading, setWorkflowLoading] = useState<string | null>(null);
  const [selectedResultActionId, setSelectedResultActionId] = usePersistedState<string>("content-creator:dashboard:selected-action-result", "");
  const [workflowResults, setWorkflowResults] = usePersistedState<Record<string, StoredWorkflowResult>>("content-creator:dashboard:workflow-results", {});
  const apiKey = data.apiKeys.openai ?? "";

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

  const selectedResult = selectedResultActionId ? workflowResults[selectedResultActionId] : undefined;

  const renderInlineMarkdown = (line: string): ReactNode[] => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return parts.map((part, idx) => {
      const bold = part.match(/^\*\*([^*]+)\*\*$/);
      if (bold) {
        return (
          <strong key={`${part}-${idx}`} className="font-semibold">
            {bold[1]}
          </strong>
        );
      }
      return <span key={`${part}-${idx}`}>{part}</span>;
    });
  };

  const formatOutput = (text: string) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return <p className="cc-muted text-sm">No output yet.</p>;
    return (
      <div className="space-y-2">
        {lines.map((line, index) => {
          const isDivider = /^(-{3,}|_{3,}|\*{3,})$/.test(line);
          if (isDivider) return <hr key={`hr-${index}`} className="my-3 border-[var(--border-default)]" />;

          const heading = line.match(/^#{1,3}\s*(.+)$/);
          if (heading) {
            return (
              <h4 key={`h-${index}`} className="pt-1 text-base font-semibold">
                {renderInlineMarkdown(heading[1])}
              </h4>
            );
          }

          const cleaned = line.replace(/^[-*]\s*/, "").replace(/^\d+[\.\)]\s*/, "");
          const isBullet = /^[-*]\s+/.test(line) || /^\d+[\.\)]\s+/.test(line);
          const looksLikeSectionTitle = /^\*\*[^*]+\*\*\s*(?:[-–—:]\s*.*)?$/.test(line);

          if (looksLikeSectionTitle && !isBullet) {
            return (
              <div key={`section-${index}`} className="pt-2">
                <p className="text-sm leading-6">{renderInlineMarkdown(line)}</p>
                <hr className="mt-2 border-[var(--border-subtle)]" />
              </div>
            );
          }

          return (
            <p key={`${line}-${index}`} className={`text-sm leading-7 ${isBullet ? "pl-3" : ""}`}>
              {isBullet ? "• " : ""}
              {renderInlineMarkdown(cleaned)}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_380px]">
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
              <span key={stage} className="cc-badge">
                {stage}: {count}
              </span>
            ))}
          </div>
        </Card>
        <Card title="Workflow actions" subtitle="Reusable skill-style actions powered by OpenAI from your brand profile and pipeline.">
          {!apiKey ? <p className="cc-muted mb-3 text-sm">Add an OpenAI key in the SaaS hub settings to run workflows.</p> : null}
          {workflowError ? <p className="mb-3 text-sm text-red-600 dark:text-red-400">{workflowError}</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
            {WORKFLOW_ACTIONS.map((action) => (
              <div key={action.id} className="cc-panel">
                <p className="font-medium">{action.name}</p>
                <p className="cc-muted mt-1 text-xs">{action.description}</p>
                <p className="cc-muted mt-1 text-xs">Inputs: {action.inputs.join(", ")} | Output: {action.outputFormat}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="cc-btn-secondary !text-xs"
                    disabled={!apiKey || workflowLoading !== null}
                    onClick={async () => {
                      setWorkflowError("");
                      setWorkflowLoading(action.id);
                      try {
                        const ideaTitles = data.ideas.slice(0, 8).map((i) => i.title);
                        const analyticsSummary =
                          data.analytics.length === 0
                            ? ""
                            : data.analytics
                                .slice(0, 5)
                                .map((a) => `${a.platform} ${a.formatUsed} views ${a.views} ER ~${calcEngagementRate(a).toFixed(2)}%`)
                                .join("; ");
                        const out = await runWorkflowAction(action, { brand: data.brandProfile, ideaTitles, analyticsSummary }, apiKey);
                        setWorkflowResults((prev) => ({
                          ...prev,
                          [action.id]: {
                            actionId: action.id,
                            actionName: action.name,
                            output: out,
                            updatedAt: new Date().toISOString(),
                          },
                        }));
                        setSelectedResultActionId(action.id);
                      } catch (e) {
                        setWorkflowError(e instanceof Error ? e.message : "Workflow failed.");
                      } finally {
                        setWorkflowLoading(null);
                      }
                    }}
                  >
                    {workflowLoading === action.id ? "Running..." : "Run workflow"}
                  </button>
                  {workflowResults[action.id] ? (
                    <button type="button" className="cc-btn-secondary !text-xs" onClick={() => setSelectedResultActionId(action.id)}>
                      View last
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-6 lg:h-fit">
        <Card title="Action Result Panel" subtitle="Latest saved workflow outputs.">
          {!selectedResult ? (
            <p className="cc-muted text-sm">Run an action or click “View last” to inspect a saved result here.</p>
          ) : (
            <div className="space-y-3">
              <div className="cc-panel">
                <p className="text-sm font-semibold">{selectedResult.actionName}</p>
                <p className="cc-muted mt-1 text-xs">Saved: {new Date(selectedResult.updatedAt).toLocaleString()}</p>
              </div>
              <div className="cc-panel max-h-[60vh] overflow-auto">{formatOutput(selectedResult.output)}</div>
            </div>
          )}
        </Card>
      </aside>
    </div>
  );
}
