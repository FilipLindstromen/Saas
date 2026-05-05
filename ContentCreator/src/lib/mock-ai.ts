import { chatCompletion, parseJsonObject } from "./openai";
import {
  BrandProfile,
  CompetitorAnalysis,
  CompetitorProfile,
  ContentIdea,
  ContentVariation,
  Platform,
  PlatformCaption,
  ReferenceDocument,
  ResearchSource,
  ScriptCard,
  WorkflowAction,
} from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);

const PLATFORMS: Platform[] = ["LinkedIn", "Instagram", "YouTube Shorts", "TikTok", "X", "Threads", "Reddit"];
const SOURCES: ResearchSource[] = [
  "X / Twitter",
  "Reddit",
  "GitHub Trending",
  "Tech news",
  "Instagram",
  "YouTube",
  "TikTok",
  "LinkedIn",
  "Manual notes",
];

function coercePlatform(value: string | undefined, fallback: Platform): Platform {
  const v = (value ?? "").trim();
  return PLATFORMS.includes(v as Platform) ? (v as Platform) : fallback;
}

function coerceSource(value: string | undefined, fallback: ResearchSource): ResearchSource {
  const v = (value ?? "").trim();
  return SOURCES.includes(v as ResearchSource) ? (v as ResearchSource) : fallback;
}

function clampScore(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 5;
  return Math.min(10, Math.max(1, Math.round(x)));
}

function brandContext(brand: BrandProfile): string {
  return [
    `Business: ${brand.businessName}`,
    `What they do: ${brand.whatIDo}`,
    `Niche: ${brand.nicheKeywords}`,
    `Voice: ${brand.brandVoice}`,
    `Audience: ${brand.audienceDescription}`,
    `Always: ${brand.alwaysRules}`,
    `Never: ${brand.neverRules}`,
    `Speaking style: ${brand.speakingStyle}`,
    `CTA prefs: ${brand.ctaPreferences}`,
    `Pillars: ${brand.contentPillars}`,
    `Offer: ${brand.offerDescription}`,
    `Formats: ${brand.preferredVideoFormats}`,
    `Avoid topics: ${brand.noGoTopics}`,
  ].join("\n");
}

/** Real OpenAI: research opportunities (synthesized angles; not live social scraping). */
export async function generateResearchIdeas(
  input: {
    topic: string;
    audience: string;
    platforms: Platform[];
    selectedSources: ResearchSource[];
    sourceSignals?: { source: ResearchSource; title: string; detail: string; url?: string }[];
    trendNotes?: string;
    count: number;
  },
  brand: BrandProfile,
  apiKey: string,
): Promise<ContentIdea[]> {
  const system = `You are a short-form content strategist. Use any provided live source snippets as evidence for trends and angles.
Return ONLY valid JSON with shape: {"ideas":[...]}.
Each idea must include: title, whyTrending, source (one sentence naming whether it used live snippets or strategic synthesis), selectedSource, audienceSizeScore, demoAbilityScore, hookPotentialScore (integers 1-10), suggestedAngle, suggestedFormat, recommendedPlatform, hook, status (always "Researched").
selectedSource must be one of: ${SOURCES.join(", ")}.
recommendedPlatform must be one of: ${PLATFORMS.join(", ")}.
Generate exactly ${input.count} ideas. Make them specific and actionable.`;

  const liveSignalsText =
    input.sourceSignals && input.sourceSignals.length
      ? input.sourceSignals
          .slice(0, 30)
          .map((s, i) => `${i + 1}. [${s.source}] ${s.title} — ${s.detail}${s.url ? ` (${s.url})` : ""}`)
          .join("\n")
      : "(none)";

  const user = `${brandContext(brand)}

Topic / niche: ${input.topic}
Target audience: ${input.audience}
Platforms to prioritize: ${input.platforms.join(", ")}
Source hints (for thematic variety only): ${input.selectedSources.join(", ")}
Optional trend notes: ${input.trendNotes || "(none)"}
Live source snippets:
${liveSignalsText}`;

  const raw = await chatCompletion({
    apiKey,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.65,
    max_tokens: 6000,
  });

  const parsed = parseJsonObject<{ ideas: Partial<ContentIdea>[] }>(raw);
  const list = Array.isArray(parsed.ideas) ? parsed.ideas : [];
  if (!list.length) {
    throw new Error("No ideas returned from the model. Try again or reduce the count.");
  }
  const defaultPlatform = input.platforms[0] ?? "LinkedIn";
  const defaultSource = input.selectedSources[0] ?? "Manual notes";

  return list.map((row, idx) => {
    const platform = coercePlatform(row.recommendedPlatform as string, input.platforms[idx % input.platforms.length] ?? defaultPlatform);
    const src = coerceSource(row.selectedSource as string, input.selectedSources[idx % input.selectedSources.length] ?? defaultSource);
    return {
      id: uid(),
      title: String(row.title ?? `Idea ${idx + 1}`),
      whyTrending: String(row.whyTrending ?? ""),
      source: String(row.source ?? "Strategic synthesis from your brief."),
      selectedSource: src,
      audienceSizeScore: clampScore(row.audienceSizeScore),
      demoAbilityScore: clampScore(row.demoAbilityScore),
      hookPotentialScore: clampScore(row.hookPotentialScore),
      suggestedAngle: String(row.suggestedAngle ?? ""),
      suggestedFormat: String(row.suggestedFormat ?? "Short-form"),
      recommendedPlatform: platform,
      status: "Researched",
      hook: String(row.hook ?? ""),
      createdAt: new Date().toISOString(),
    };
  });
}

export async function generateVariations(idea: ContentIdea, brand: BrandProfile, apiKey: string): Promise<ContentVariation[]> {
  const system = `You are a content ideation expert. Return ONLY JSON: {"variations":[...]} with exactly 5 objects.
Fields per variation: title, formatType (e.g. tutorial, hot take, demo, comparison, story), targetViewer, coreThesis, hookIdea, whyAngleWorks, recommendedPlatform, recommendedSourceInsight, difficultyScore, estimatedPerformanceScore (1-10).
recommendedPlatform must be one of: ${PLATFORMS.join(", ")}.`;

  const user = `${brandContext(brand)}

Base idea title: ${idea.title}
Hook: ${idea.hook}
Angle: ${idea.suggestedAngle}
Format: ${idea.suggestedFormat}
Platform: ${idea.recommendedPlatform}
Source note: ${idea.source}`;

  const raw = await chatCompletion({
    apiKey,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 3500,
  });

  const parsed = parseJsonObject<{ variations: Partial<ContentVariation>[] }>(raw);
  const list = Array.isArray(parsed.variations) ? parsed.variations.slice(0, 5) : [];
  if (!list.length) {
    throw new Error("No variations returned from the model. Try again.");
  }

  return list.map((row, index) => ({
    id: uid(),
    ideaId: idea.id,
    title: String(row.title ?? `${idea.title} (variation ${index + 1})`),
    formatType: String(row.formatType ?? "tutorial"),
    targetViewer: String(row.targetViewer ?? "creators"),
    coreThesis: String(row.coreThesis ?? ""),
    hookIdea: String(row.hookIdea ?? ""),
    whyAngleWorks: String(row.whyAngleWorks ?? ""),
    recommendedPlatform: coercePlatform(row.recommendedPlatform as string, idea.recommendedPlatform),
    recommendedSourceInsight: String(row.recommendedSourceInsight ?? idea.source),
    difficultyScore: clampScore(row.difficultyScore),
    estimatedPerformanceScore: clampScore(row.estimatedPerformanceScore),
  }));
}

export async function generateScript(idea: ContentIdea, refs: ReferenceDocument[], brand: BrandProfile, apiKey: string): Promise<ScriptCard> {
  const refBundle = refs.map((r) => `### ${r.id}\n${r.content}`).join("\n\n");

  const system = `You are a short-form video script coach. Output bullet-friendly filming guidance (not a word-for-word teleprompter).
Return ONLY JSON with keys: hookOptions (array of 6 {text, strength} strength 1-10 descending), bestHookRecommendation, talkingPoints (3 strings), specificExamples (2 strings), patternInterruptIdea, closingLine, cta, captionDraft, platformCaptions (array of exactly 6 objects with platform and caption). Platforms must be exactly these strings in order: TikTok, Instagram Reels, YouTube Shorts, LinkedIn, X, Threads.
Also include notes (one line), platform (one of ${PLATFORMS.join(", ")}), format (string).`;

  const user = `${brandContext(brand)}

Reference docs:
${refBundle}

Idea title: ${idea.title}
Hook seed: ${idea.hook}
Angle: ${idea.suggestedAngle}
Format: ${idea.suggestedFormat}
Default platform: ${idea.recommendedPlatform}`;

  const raw = await chatCompletion({
    apiKey,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.65,
    max_tokens: 4500,
  });

  type Row = {
    hookOptions?: { text?: string; strength?: number }[];
    bestHookRecommendation?: string;
    talkingPoints?: string[];
    specificExamples?: string[];
    patternInterruptIdea?: string;
    closingLine?: string;
    cta?: string;
    captionDraft?: string;
    platformCaptions?: { platform?: string; caption?: string }[];
    notes?: string;
    platform?: string;
    format?: string;
  };

  const row = parseJsonObject<Row>(raw);
  const hookOptions = (Array.isArray(row.hookOptions) ? row.hookOptions : [])
    .slice(0, 6)
    .map((h, i) => ({ text: String(h.text ?? ""), strength: clampScore(h.strength ?? 10 - i) }));

  while (hookOptions.length < 6) {
    hookOptions.push({ text: idea.hook, strength: 10 - hookOptions.length });
  }

  const requiredPlatforms: PlatformCaption["platform"][] = ["TikTok", "Instagram Reels", "YouTube Shorts", "LinkedIn", "X", "Threads"];
  const caps = Array.isArray(row.platformCaptions) ? row.platformCaptions : [];
  const platformCaptions: ScriptCard["platformCaptions"] = requiredPlatforms.map((platform, i) => ({
    platform,
    caption: String(caps[i]?.caption ?? row.captionDraft ?? ""),
  }));

  return {
    id: uid(),
    ideaId: idea.id,
    hookOptions,
    bestHookRecommendation: String(row.bestHookRecommendation ?? hookOptions[0]?.text ?? idea.hook),
    talkingPoints: (Array.isArray(row.talkingPoints) ? row.talkingPoints : ["Problem", "Framework", "Action"]).map(String).slice(0, 5),
    specificExamples: (Array.isArray(row.specificExamples) ? row.specificExamples : ["Example A", "Example B"]).map(String).slice(0, 5),
    patternInterruptIdea: String(row.patternInterruptIdea ?? ""),
    closingLine: String(row.closingLine ?? ""),
    cta: String(row.cta ?? ""),
    captionDraft: String(row.captionDraft ?? ""),
    platformCaptions,
    notes: String(row.notes ?? "Film from bullets; keep it conversational."),
    platform: coercePlatform(row.platform, idea.recommendedPlatform),
    format: String(row.format ?? idea.suggestedFormat),
    filmed: false,
  };
}

export async function runWorkflowAction(
  action: WorkflowAction,
  ctx: {
    brand: BrandProfile;
    ideaTitles: string[];
    analyticsSummary: string;
  },
  apiKey: string,
): Promise<string> {
  const system = `You are the "${action.name}" workflow inside a creator OS app. Execute the workflow using the context. Be concise (max ~12 sentences). No JSON. Plain text with short bullets if helpful. State that outputs are generated via OpenAI from the user's data (not auto-posted anywhere).`;

  const user = `Workflow: ${action.name}
Description: ${action.description}
Expected output format label: ${action.outputFormat}
Inputs described: ${action.inputs.join(", ")}

Brand / context:
${brandContext(ctx.brand)}

Sample idea titles in pipeline: ${ctx.ideaTitles.length ? ctx.ideaTitles.join("; ") : "(none yet)"}

Analytics summary (manual entries): ${ctx.analyticsSummary || "(none)"}`;

  return chatCompletion({
    apiKey,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.55,
    max_tokens: 1200,
  });
}

export async function generateCompetitorAnalysis(profile: CompetitorProfile, apiKey: string): Promise<CompetitorAnalysis> {
  const system = `You are a competitive content analyst. You only have the user's manual notes (no live scraping). Return ONLY JSON:
{"contentPillars":string[],"hookPatterns":string[],"formatPatterns":string[],"postingStrategy":string,"whatTheyDoWell":string[],"exploitGaps":string[],"inspiredIdeas":string[]}
inspiredIdeas must have exactly 10 strings.`;

  const user = `Creator: ${profile.creatorName}
Platform: ${profile.platform}
URL: ${profile.profileUrl}
Niche: ${profile.niche}
Notes: ${profile.notes}
Example posts: ${profile.examplePostUrls}
Observed hooks: ${profile.observedHooks}
Observed formats: ${profile.observedFormats}
Posting frequency: ${profile.postingFrequency}
Top-performing notes: ${profile.topPerformingNotes}`;

  const raw = await chatCompletion({
    apiKey,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.55,
    max_tokens: 3500,
  });

  const row = parseJsonObject<{
    contentPillars?: string[];
    hookPatterns?: string[];
    formatPatterns?: string[];
    postingStrategy?: string;
    whatTheyDoWell?: string[];
    exploitGaps?: string[];
    inspiredIdeas?: string[];
  }>(raw);

  const ideas = Array.isArray(row.inspiredIdeas) ? row.inspiredIdeas.map(String).slice(0, 10) : [];
  while (ideas.length < 10) {
    ideas.push(`Content idea ${ideas.length + 1} for ${profile.niche}`);
  }

  return {
    id: uid(),
    competitorProfileId: profile.id,
    contentPillars: Array.isArray(row.contentPillars) ? row.contentPillars.map(String) : [],
    hookPatterns: Array.isArray(row.hookPatterns) ? row.hookPatterns.map(String) : [],
    formatPatterns: Array.isArray(row.formatPatterns) ? row.formatPatterns.map(String) : [],
    postingStrategy: String(row.postingStrategy ?? ""),
    whatTheyDoWell: Array.isArray(row.whatTheyDoWell) ? row.whatTheyDoWell.map(String) : [],
    exploitGaps: Array.isArray(row.exploitGaps) ? row.exploitGaps.map(String) : [],
    inspiredIdeas: ideas,
  };
}
