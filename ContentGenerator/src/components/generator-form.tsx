"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { generateQuestions } from "@/app/actions/generate-questions";
import { buildUserPrompt, type GenerationSettings } from "@/lib/prompt-builder";
import { loadGeneratorState, saveGeneratorState } from "@/lib/form-storage";
import { Loader2 } from "lucide-react";
import { ResultsCards } from "./results-cards";
import { ApiKeySettings } from "./api-key-settings";

interface GeneratorFormProps {
  themes: string[];
  tones: string[];
  formats: string[];
  platforms: string[];
  onGenerateComplete?: () => void;
}

const INTENSITY_LABELS = ["Soft", "Medium", "Direct"] as const;

export function GeneratorForm({
  themes,
  tones,
  formats,
  platforms,
  onGenerateComplete,
}: GeneratorFormProps) {
  const [audience, setAudience] = useState("");
  const [theme, setTheme] = useState(themes[0] ?? "Stress");
  const [tone, setTone] = useState<string[]>([]);
  const [format, setFormat] = useState<string[]>([]);
  const [platform, setPlatform] = useState<string[]>([]);
  const [intensity, setIntensity] = useState<number>(1);
  const [context, setContext] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [generateHooks, setGenerateHooks] = useState(true);
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadGeneratorState();
    setAudience(stored.audience);
    setTheme(themes.includes(stored.theme) ? stored.theme : themes[0] ?? "Stress");
    setTone(stored.tone.filter((t) => tones.includes(t)));
    setFormat(stored.format.filter((f) => formats.includes(f)));
    setPlatform(stored.platform.filter((p) => platforms.includes(p)));
    setIntensity(Math.min(2, Math.max(0, stored.intensity)));
    setContext(stored.context);
    setNumQuestions(Math.min(30, Math.max(1, stored.numQuestions)));
    setGenerateHooks(stored.generateHooks);
    setSaveToLibrary(stored.saveToLibrary);
    setShowPromptPreview(stored.showPromptPreview);
    setHydrated(true);
  }, []);

  // Save to localStorage when form state changes (skip initial load)
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    saveGeneratorState({
      audience,
      theme,
      tone,
      format,
      platform,
      intensity,
      context,
      numQuestions,
      generateHooks,
      saveToLibrary,
      showPromptPreview,
    });
  }, [
    hydrated,
    audience,
    theme,
    tone,
    format,
    platform,
    intensity,
    context,
    numQuestions,
    generateHooks,
    saveToLibrary,
    showPromptPreview,
  ]);
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const { loadApiKeys } = require("@shared/apiKeys");
        const keys = loadApiKeys();
        setApiKey(keys.openai || "");
      } catch {
        setApiKey("");
      }
    }
  }, [showSettings]);
  const [result, setResult] = useState<{
    success: boolean;
    questions?: Array<{
      question: string;
      theme: string;
      tags: string[];
      hooks: string[];
      why_it_works: string;
    }>;
    safety_note?: string;
    error?: string;
  } | null>(null);

  const toggleMulti = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  async function handleGenerate() {
    if (!apiKey?.trim()) {
      setShowSettings(true);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await generateQuestions({
        audience: audience || "people interested in personal development",
        theme,
        tone: tone.length ? tone : ["warm"],
        format: format.length ? format : ["truth bomb"],
        platform: platform.length ? platform : ["YouTube"],
        intensity: (["soft", "medium", "direct"] as const)[intensity],
        context: context || undefined,
        numQuestions,
        generateHooks,
        saveToLibrary,
        apiKey: apiKey.trim(),
      });
      setResult(res);
      if (res.success) onGenerateComplete?.();
    } finally {
      setLoading(false);
    }
  }

  const settings: GenerationSettings = {
    audience: audience || "people interested in personal development",
    theme,
    tone: tone.length ? tone : ["warm"],
    format: format.length ? format : ["truth bomb"],
    platform: platform.length ? platform : ["YouTube"],
    intensity: (["soft", "medium", "direct"] as const)[intensity],
    context: context || undefined,
    numQuestions,
    generateHooks,
  };

  const promptPreview = showPromptPreview
    ? buildUserPrompt(settings, [{ title: "[Sample signal]", selftext: "", permalink: "" }])
    : null;

  return (
    <div id="generator-form" className="rounded-[var(--card-radius)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-md)]">
      <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Generate Video Questions</h2>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            Audience / persona
          </label>
          <Input
            placeholder="e.g. anxious overthinker, burned-out high performer"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Primary theme</label>
          <select
            value={themes.includes(theme) ? theme : themes[0]}
            onChange={(e) => setTheme(e.target.value)}
            className="flex h-10 w-full items-center justify-between rounded-[var(--button-radius)] border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {themes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Tone</label>
          <div className="flex flex-wrap gap-2">
            {tones.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(toggleMulti(tone, t))}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  tone.includes(t)
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Format</label>
          <div className="flex flex-wrap gap-2">
            {formats.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(toggleMulti(format, f))}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  format.includes(f)
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Platform</label>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(toggleMulti(platform, p))}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  platform.includes(p)
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            Intensity: {INTENSITY_LABELS[intensity]}
          </label>
          <Slider
            value={[intensity]}
            onValueChange={([v]) => setIntensity(v)}
            min={0}
            max={2}
            step={1}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            Context / situation (optional)
          </label>
          <Input
            placeholder="e.g. can't relax without guilt, doomscrolling, panic before meetings"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            Number of questions
          </label>
          <Input
            type="number"
            min={1}
            max={30}
            value={numQuestions}
            onChange={(e) => setNumQuestions(parseInt(e.target.value, 10) || 10)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={generateHooks}
              onCheckedChange={(c) => setGenerateHooks(!!c)}
            />
            <span className="text-sm text-[var(--text-primary)]">Generate hooks too</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={saveToLibrary}
              onCheckedChange={(c) => setSaveToLibrary(!!c)}
            />
            <span className="text-sm text-[var(--text-primary)]">Save to library</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={showPromptPreview}
              onCheckedChange={(c) => setShowPromptPreview(!!c)}
            />
            <span className="text-sm text-[var(--text-primary)]">Prompt preview</span>
          </label>
        </div>
      </div>

      {promptPreview && (
        <div className="mt-4 rounded-[var(--button-radius)] border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
          <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Prompt preview</p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-[var(--text-tertiary)]">
            {promptPreview}
          </pre>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button onClick={handleGenerate} disabled={loading} size="lg">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : (
            "Generate"
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
          Settings
        </Button>
      </div>
      <ApiKeySettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={() => {
          setShowSettings(false);
          try {
            const { loadApiKeys } = require("@shared/apiKeys");
            setApiKey(loadApiKeys().openai || "");
          } catch {
            /* ignore */
          }
        }}
      />

      {result && (
        <div className="mt-6">
          {result.safety_note && (
            <div className="mb-4 rounded-[var(--button-radius)] border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-4 py-2 text-sm text-[var(--text-secondary)]">
              {result.safety_note}
            </div>
          )}
          {result.success && result.questions ? (
            <ResultsCards
              questions={result.questions}
              onRegenerate={handleGenerate}
              onRefine={() => document.getElementById("generator-form")?.scrollIntoView({ behavior: "smooth" })}
            />
          ) : (
            <div className="rounded-[var(--button-radius)] bg-red-500/20 px-4 py-2 text-red-400">
              {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
