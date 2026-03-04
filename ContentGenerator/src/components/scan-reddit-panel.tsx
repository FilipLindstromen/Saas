"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scanReddit } from "@/app/actions/scan-reddit";
import { loadScanState, saveScanState } from "@/lib/form-storage";
import { Loader2 } from "lucide-react";

const TIME_OPTIONS = [
  { value: "day", label: "Past 24 hours" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
  { value: "year", label: "Past year" },
] as const;

const SORT_OPTIONS = [
  { value: "top", label: "Top (recommended)" },
  { value: "hot", label: "Hot" },
  { value: "new", label: "New" },
] as const;

const DEFAULT_SUBREDDITS_STR =
  "anxiety, stress, overthinking, selfimprovement, mentalhealth, socialanxiety, productivity, getdisciplined, adhd, depression";

function parseSubreddits(input: string): string[] {
  if (!input?.trim()) return [];
  return input
    .split(/[\s,]+/)
    .map((s) => s.replace(/^r\//, "").trim().toLowerCase())
    .filter(Boolean);
}

export function ScanRedditPanel({ onScanComplete }: { onScanComplete?: () => void }) {
  const [subredditsInput, setSubredditsInput] = useState("");
  const [timeRange, setTimeRange] = useState<string>("week");
  const [sort, setSort] = useState<string>("top");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadScanState();
    setSubredditsInput(stored.subredditsInput);
    setTimeRange(["day", "week", "month", "year"].includes(stored.timeRange) ? stored.timeRange : "week");
    setSort(["top", "hot", "new"].includes(stored.sort) ? stored.sort : "top");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    saveScanState({ subredditsInput, timeRange, sort });
  }, [hydrated, subredditsInput, timeRange, sort]);
  const [result, setResult] = useState<{ success: boolean; signalsCreated: number; error?: string } | null>(null);

  async function handleScan() {
    setLoading(true);
    setResult(null);
    const subreddits = parseSubreddits(subredditsInput);
    const validTime = ["day", "week", "month", "year"].includes(timeRange) ? timeRange : "week";
    const validSort = ["top", "hot", "new"].includes(sort) ? sort : "top";
    try {
      const res = await scanReddit({
        subreddits: subreddits.length > 0 ? subreddits : undefined,
        timeRange: validTime as "day" | "week" | "month" | "year",
        sort: validSort as "hot" | "top" | "new",
        postsPerSub: 10,
        fetchComments: true,
      });
      setResult(res);
      if (res.success) onScanComplete?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      setResult({ success: false, signalsCreated: 0, error: msg });
      console.error("Scan Reddit error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[var(--card-radius)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-md)]">
      <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Source Scanner</h2>
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
          Subreddits
        </label>
        <Input
          placeholder={DEFAULT_SUBREDDITS_STR}
          value={subredditsInput}
          onChange={(e) => setSubredditsInput(e.target.value)}
          className="w-full"
        />
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Comma- or space-separated. Leave empty for personal development defaults. No Reddit API key needed—uses public data.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[140px]">
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Time range</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="flex h-10 w-full items-center justify-between rounded-[var(--button-radius)] border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Sort by</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="flex h-10 w-full items-center justify-between rounded-[var(--button-radius)] border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={handleScan} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scanning…
            </>
          ) : (
            "Scan Reddit"
          )}
        </Button>
      </div>
      {result && (
        <div
          className={`mt-4 rounded-[var(--button-radius)] px-4 py-2 text-sm ${
            result.success ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]" : "bg-red-500/20 text-red-400"
          }`}
        >
          {result.success
            ? `Stored ${result.signalsCreated} signals.`
            : `Error: ${result.error}`}
        </div>
      )}
    </div>
  );
}
