"use client";

import { useEffect, useState } from "react";
import { ResultsCards } from "./results-cards";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StoredResult {
  id: string;
  questions: string;
  settings: string;
  createdAt: string;
}

interface ParsedQuestion {
  question: string;
  theme: string;
  tags: string[];
  hooks: string[];
  why_it_works: string;
}

export function ResultsLibrary() {
  const [results, setResults] = useState<StoredResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/results")
      .then((r) => r.json())
      .then((d) => setResults(d.results ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  async function copyAll(id: string, questions: ParsedQuestion[]) {
    const text = questions
      .map((q) => `${q.question}\n${q.hooks.join("\n")}`)
      .join("\n\n---\n\n");
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) {
    return (
      <div className="rounded-[var(--card-radius)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-md)]">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Results Library</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[var(--button-radius)] bg-[var(--bg-tertiary)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--card-radius)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-md)]">
      <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Results Library</h2>
      <p className="mb-4 text-sm text-[var(--text-tertiary)]">
        Previously generated questions. Click to expand and copy.
      </p>
      {results.length === 0 ? (
        <p className="rounded-[var(--button-radius)] bg-[var(--bg-tertiary)] px-4 py-6 text-center text-[var(--text-tertiary)]">
          No saved results yet. Generate questions to populate.
        </p>
      ) : (
        <div className="space-y-4">
          {results.map((r) => {
            let questions: ParsedQuestion[] = [];
            try {
              questions = JSON.parse(r.questions);
            } catch {
              questions = [];
            }
            const isExpanded = expandedId === r.id;
            const date = new Date(r.createdAt).toLocaleString();

            return (
              <div
                key={r.id}
                className="rounded-[var(--button-radius)] border border-[var(--border-default)] bg-[var(--bg-tertiary)]"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-[var(--text-primary)]"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <span className="text-sm font-medium">
                    {questions.length} questions · {date}
                  </span>
                  <span className="text-[var(--text-tertiary)]">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </button>
                {isExpanded && (
                  <div className="border-t border-[var(--border-default)] px-4 py-3">
                    <div className="mb-2 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyAll(r.id, questions)}
                      >
                        {copiedId === r.id ? (
                          <Check className="mr-1 h-4 w-4 text-[var(--accent)]" />
                        ) : (
                          <Copy className="mr-1 h-4 w-4" />
                        )}
                        Copy all
                      </Button>
                    </div>
                    <ResultsCards questions={questions} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
