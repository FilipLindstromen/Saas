"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/app-shell";
import { useAppState } from "@/lib/app-state";
import { calcEngagementRate } from "@/lib/scoring";
import { Platform } from "@/lib/types";

export default function AnalyticsPage() {
  const { data, addAnalytics } = useAppState();
  const [form, setForm] = useState({
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    watchTime: 0,
    platform: "Instagram" as Platform,
    postedDate: new Date().toISOString().slice(0, 10),
    hookUsed: "",
    formatUsed: "",
  });

  const summary = useMemo(() => {
    const entries = data.analytics;
    const avg = entries.length ? entries.reduce((a, e) => a + calcEngagementRate(e), 0) / entries.length : 0;
    return { avg, topHook: entries[0]?.hookUsed ?? "N/A", topFormat: entries[0]?.formatUsed ?? "N/A", bestPlatform: entries[0]?.platform ?? "N/A" };
  }, [data.analytics]);

  const numericFields: Array<keyof typeof form> = ["views", "likes", "comments", "shares", "saves", "watchTime"];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Analytics</h2>
      <Card title="Manual entry">
        <div className="grid gap-2 md:grid-cols-3">
          {numericFields.map((key) => (
            <input
              key={key}
              type="number"
              className="cc-input"
              placeholder={key}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
            />
          ))}
          <input className="cc-input" placeholder="platform" value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as Platform }))} />
          <input type="date" className="cc-input" value={form.postedDate} onChange={(e) => setForm((f) => ({ ...f, postedDate: e.target.value }))} />
          <input className="cc-input" placeholder="hook used" value={form.hookUsed} onChange={(e) => setForm((f) => ({ ...f, hookUsed: e.target.value }))} />
          <input className="cc-input md:col-span-2" placeholder="format used" value={form.formatUsed} onChange={(e) => setForm((f) => ({ ...f, formatUsed: e.target.value }))} />
        </div>
        <button type="button" className="cc-btn-primary mt-2" onClick={() => addAnalytics({ id: Math.random().toString(36).slice(2, 10), ...form })}>
          Save entry
        </button>
      </Card>
      <Card title="Insights">
        <p>Top-performing hooks: {summary.topHook}</p>
        <p>Top-performing formats: {summary.topFormat}</p>
        <p>Best platforms: {summary.bestPlatform}</p>
        <p>Average engagement rate: {summary.avg.toFixed(2)}%</p>
        <p className="cc-muted mt-2 text-sm">Suggestions: make more of top hooks, revisit high-watch-time topics, stop low-engagement formats after 5 tests.</p>
      </Card>
    </div>
  );
}

