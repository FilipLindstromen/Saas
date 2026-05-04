import {
  BrandProfile,
  CompetitorAnalysis,
  CompetitorProfile,
  ContentIdea,
  ContentVariation,
  Platform,
  ReferenceDocument,
  ResearchSource,
  ScriptCard,
  WorkflowAction,
} from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);
const formats = ["Tutorial", "Hot take", "Demo", "Comparison", "Story", "Mistake", "Checklist", "Reaction"];
const platforms: Platform[] = ["LinkedIn", "Instagram", "YouTube Shorts", "TikTok", "X", "Threads"];

export function generateResearchIdeas(input: {
  topic: string;
  audience: string;
  platforms: Platform[];
  selectedSources: ResearchSource[];
  trendNotes?: string;
  count: number;
}, brand: BrandProfile): ContentIdea[] {
  return Array.from({ length: input.count }).map((_, idx) => {
    const selectedSource = input.selectedSources[idx % input.selectedSources.length] ?? "Manual notes";
    const platform = input.platforms[idx % input.platforms.length] ?? platforms[idx % platforms.length];
    const format = formats[idx % formats.length];
    return {
      id: uid(),
      title: `${input.topic} ${format} play #${idx + 1}`,
      whyTrending: `Mock insight: ${selectedSource} conversations show consistent demand around ${input.topic}.`,
      source: `V1 placeholder from ${selectedSource}. Live access requires future API/scraper integration.`,
      selectedSource,
      audienceSizeScore: 6 + (idx % 5),
      demoAbilityScore: 5 + ((idx + 2) % 5),
      hookPotentialScore: 6 + ((idx + 1) % 5),
      suggestedAngle: `Connect ${input.topic} to ${brand.offerDescription.toLowerCase()} with one quick case example.`,
      suggestedFormat: format,
      recommendedPlatform: platform,
      status: "Researched",
      hook: `Most creators overcomplicate ${input.topic}. Try this instead.`,
      createdAt: new Date().toISOString(),
    };
  });
}

export function generateVariations(idea: ContentIdea): ContentVariation[] {
  const list = ["tutorial", "hot take", "demo", "comparison", "story"];
  return list.map((formatType, index) => ({
    id: uid(),
    ideaId: idea.id,
    title: `${idea.title} (${formatType})`,
    formatType,
    targetViewer: index % 2 ? "intermediate creator" : "beginner creator",
    coreThesis: `Practical content systems beat random inspiration when executing ${idea.title}.`,
    hookIdea: `${idea.hook} (${formatType} version)`,
    whyAngleWorks: `This ${formatType} angle simplifies the message and improves watch retention.`,
    recommendedPlatform: idea.recommendedPlatform,
    recommendedSourceInsight: idea.source,
    difficultyScore: 3 + index,
    estimatedPerformanceScore: 6 + (index % 4),
  }));
}

export function generateScript(idea: ContentIdea, refs: ReferenceDocument[]): ScriptCard {
  const voice = refs.find((r) => r.id === "scripting-voice.md")?.content ?? "direct and practical";
  const hookOptions = [
    idea.hook,
    `If you are stuck with ${idea.title.toLowerCase()}, use this framework.`,
    `The hidden mistake in ${idea.title.toLowerCase()} (and what to do instead).`,
    `Do this before your next ${idea.recommendedPlatform} upload.`,
    "This one shift can multiply your short-form consistency.",
    "If I restarted today, this is the first thing I would fix.",
  ].map((text, idx) => ({ text, strength: 10 - idx }));

  return {
    id: uid(),
    ideaId: idea.id,
    hookOptions,
    bestHookRecommendation: hookOptions[0].text,
    talkingPoints: ["Name the pain clearly", "Share a practical 3-step framework", "Give one immediate action"],
    specificExamples: ["Before/after content workflow", "One audience pain point turned into hook"],
    patternInterruptIdea: "Mid-video switch to a list view and ask a direct question.",
    closingLine: "Test this today and come back with results in seven days.",
    cta: "Comment SYSTEM and I will share the checklist.",
    captionDraft: `${idea.title} in simple bullet points. Save this for your next filming block.`,
    platformCaptions: ["TikTok", "Instagram Reels", "YouTube Shorts", "LinkedIn", "X", "Threads"].map((platform) => ({
      platform: platform as ScriptCard["platformCaptions"][number]["platform"],
      caption: `${idea.title} adapted for ${platform}. Voice note: ${voice.slice(0, 70)}...`,
    })),
    notes: "This script is built for bullet-point filming, not line-by-line reading.",
    platform: idea.recommendedPlatform,
    format: idea.suggestedFormat,
    filmed: false,
  };
}

// TODO(v2): Replace with real LLM + tools orchestration.
export function runWorkflowAction(action: WorkflowAction) {
  return `${action.name} executed in mock mode. Output format: ${action.outputFormat}.`;
}

// TODO(v2): Replace with live source/API competitor analysis.
export function generateCompetitorAnalysis(profile: CompetitorProfile): CompetitorAnalysis {
  return {
    id: uid(),
    competitorProfileId: profile.id,
    contentPillars: ["Education", "Opinion", "Case studies"],
    hookPatterns: ["Pain-first hooks", "Contrarian statements", "Challenge format hooks"],
    formatPatterns: ["Talking head", "Screen demo", "Listicle breakdown"],
    postingStrategy: `${profile.creatorName} appears to use repeatable format templates and frequent CTAs.`,
    whatTheyDoWell: ["Strong first 3 seconds", "Simple messaging", "Consistent cadence"],
    exploitGaps: ["Few practical implementation examples", "Weak CTA variety", "Limited behind-the-scenes proof"],
    inspiredIdeas: Array.from({ length: 10 }).map((_, i) => `Inspired idea ${i + 1}: ${profile.niche} angle with stronger demonstration.`),
  };
}
