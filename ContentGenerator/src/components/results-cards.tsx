"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, RefreshCw, Edit3 } from "lucide-react";

interface QuestionResult {
  question: string;
  theme: string;
  tags: string[];
  hooks: string[];
  why_it_works: string;
}

export function ResultsCards({
  questions,
  onRegenerate,
  onRefine,
}: {
  questions: QuestionResult[];
  onRegenerate?: () => void;
  onRefine?: () => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyToClipboard(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Generated Questions</h3>
        <div className="flex gap-2">
          {onRegenerate && (
            <Button variant="outline" size="sm" onClick={onRegenerate}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Regenerate
            </Button>
          )}
          {onRefine && (
            <Button variant="ghost" size="sm" onClick={onRefine}>
              <Edit3 className="mr-1 h-4 w-4" />
              Refine
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {questions.map((q, i) => (
          <div
            key={i}
            className="rounded-[var(--button-radius)] border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4"
          >
            <p className="mb-2 font-medium text-[var(--text-primary)]">{q.question}</p>
            <div className="mb-2 flex flex-wrap gap-1">
              {q.tags.map((t) => (
                <span
                  key={t}
                  className="rounded bg-[var(--bg-hover)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                >
                  {t}
                </span>
              ))}
            </div>
            {q.hooks.length > 0 && (
              <div className="mb-2">
                <p className="mb-1 text-xs font-medium text-[var(--text-tertiary)]">Hooks:</p>
                <ul className="list-inside list-disc text-sm text-[var(--text-secondary)]">
                  {q.hooks.map((h, j) => (
                    <li key={j}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
            {q.why_it_works && (
              <p className="mb-2 text-xs italic text-[var(--text-tertiary)]">{q.why_it_works}</p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(q.question, `q-${i}`)}
              >
                {copiedId === `q-${i}` ? (
                  <Check className="h-4 w-4 text-[var(--accent)]" />
                ) : (
                  <Copy className="mr-1 h-4 w-4" />
                )}
                Copy question
              </Button>
              {q.hooks.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(q.hooks.join("\n"), `h-${i}`)
                  }
                >
                  {copiedId === `h-${i}` ? (
                    <Check className="h-4 w-4 text-[var(--accent)]" />
                  ) : (
                    <Copy className="mr-1 h-4 w-4" />
                  )}
                  Copy hooks
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
