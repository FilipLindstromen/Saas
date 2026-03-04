"use client";

import { useState } from "react";
import { GeneratorForm } from "@/components/generator-form";
import { SignalsTable } from "@/components/signals-table";
import { ResultsLibrary } from "@/components/results-library";
import { ScanRedditPanel } from "@/components/scan-reddit-panel";
import { ApiKeySettings } from "@/components/api-key-settings";
import { ThemeToggleClient } from "@/components/theme-toggle-client";

const THEMES = [
  "Stress",
  "Anxiety",
  "Overthinking",
  "Burnout",
  "People-pleasing",
  "Motivation",
  "Self-worth",
  "Loneliness",
  "Productivity guilt",
] as const;

const TONES = ["warm", "blunt", "funny", "calm", "scientific"] as const;
const FORMATS = ["myth-bust", "story", "checklist", "truth bomb", "you're not broken"] as const;
const PLATFORMS = ["TikTok", "Reels", "Shorts", "YouTube"] as const;

export default function HomePage() {
  const [signalsRefresh, setSignalsRefresh] = useState(0);
  const [resultsRefresh, setResultsRefresh] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 md:px-6 md:py-10">
      {/* Header */}
      <header className="mb-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">
              ContentGenerator
            </h1>
            <p className="mt-1 text-[var(--text-tertiary)]">
              Transform Reddit pain points into curiosity-driven video questions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggleClient />
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="cursor-pointer rounded-[var(--button-radius)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
            >
              Settings
            </button>
          </div>
        </div>
        <p className="mt-4 rounded-[var(--card-radius)] border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-4 py-2 text-sm text-[var(--text-secondary)]">
          <strong>Disclaimer:</strong> This tool generates content ideas only. It does not provide
          medical advice. If you are experiencing a mental health crisis, please consult a
          qualified professional.
        </p>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">
          API keys are shared with other Saas apps. Configure in Settings.
        </p>
      </header>
      <ApiKeySettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={() => setShowSettings(false)}
      />

      {/* 3-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Reddit */}
        <div className="flex flex-col gap-6">
          <ScanRedditPanel onScanComplete={() => setSignalsRefresh((r) => r + 1)} />
          <SignalsTable key={signalsRefresh} />
        </div>

        {/* Middle: Generate */}
        <div>
          <GeneratorForm
            themes={[...THEMES]}
            tones={[...TONES]}
            formats={[...FORMATS]}
            platforms={[...PLATFORMS]}
            onGenerateComplete={() => setResultsRefresh((r) => r + 1)}
          />
        </div>

        {/* Right: Results */}
        <div>
          <ResultsLibrary key={resultsRefresh} />
        </div>
      </div>
    </main>
  );
}
