"use client";

import { useEffect, useState } from "react";

// Signals fetched via /api/signals
type SignalRow = {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  score: number;
  numComments: number;
  permalink: string;
  signalScore: number;
  themeTags: string;
  flagged: boolean;
};

export function SignalsTable() {
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/signals")
      .then((r) => r.json())
      .then((d) => {
        setSignals(d.signals ?? []);
      })
      .catch(() => setSignals([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-[var(--card-radius)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-md)]">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Signals</h2>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[var(--button-radius)] bg-[var(--bg-tertiary)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--card-radius)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-md)]">
      <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Signals</h2>
      <p className="mb-4 text-sm text-[var(--text-tertiary)]">
        Pain-point content ranked by emotion intensity, relatability, and engagement. Run &quot;Scan
        Reddit&quot; to populate.
      </p>
      {signals.length === 0 ? (
        <p className="rounded-[var(--button-radius)] bg-[var(--bg-tertiary)] px-4 py-6 text-center text-[var(--text-tertiary)]">
          No signals yet. Click &quot;Scan Reddit&quot; to fetch content.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th className="py-2 text-left font-medium text-[var(--text-secondary)]">Score</th>
                <th className="py-2 text-left font-medium text-[var(--text-secondary)]">Subreddit</th>
                <th className="py-2 text-left font-medium text-[var(--text-secondary)]">Title</th>
                <th className="py-2 text-left font-medium text-[var(--text-secondary)]">Theme tags</th>
                <th className="py-2 text-left font-medium text-[var(--text-secondary)]">Link</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.id} className="border-b border-[var(--border-subtle)]">
                  <td className="py-2 font-mono text-[var(--text-tertiary)]">{s.signalScore.toFixed(1)}</td>
                  <td className="py-2 text-[var(--text-tertiary)]">r/{s.subreddit}</td>
                  <td className="max-w-md py-2 text-[var(--text-primary)]">
                    <span className="line-clamp-2">{s.title}</span>
                  </td>
                  <td className="py-2 text-[var(--text-tertiary)]">{s.themeTags || "—"}</td>
                  <td className="py-2">
                    <a
                      href={s.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] underline hover:text-[var(--accent-hover)]"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
