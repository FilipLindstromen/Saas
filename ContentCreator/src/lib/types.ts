export type PipelineStatus = "Idea" | "Researched" | "Ideated" | "Scripted" | "Filmed" | "Posted";

export type Platform =
  | "LinkedIn"
  | "Instagram"
  | "YouTube Shorts"
  | "TikTok"
  | "X"
  | "Threads"
  | "Reddit";

export type ResearchSource =
  | "X / Twitter"
  | "Reddit"
  | "GitHub Trending"
  | "Tech news"
  | "Instagram"
  | "YouTube"
  | "TikTok"
  | "LinkedIn"
  | "Manual notes";

export interface BrandProfile {
  businessName: string;
  whatIDo: string;
  platformsAndHandles: string;
  nicheKeywords: string;
  brandVoice: string;
  alwaysRules: string;
  neverRules: string;
  audienceDescription: string;
  speakingStyle: string;
  ctaPreferences: string;
  contentPillars: string;
  offerDescription: string;
  preferredVideoFormats: string;
  noGoTopics: string;
}

export interface ContentIdea {
  id: string;
  title: string;
  whyTrending: string;
  source: string;
  selectedSource: ResearchSource;
  audienceSizeScore: number;
  demoAbilityScore: number;
  hookPotentialScore: number;
  suggestedAngle: string;
  suggestedFormat: string;
  recommendedPlatform: Platform;
  status: PipelineStatus;
  hook: string;
  createdAt: string;
}

export interface ContentVariation {
  id: string;
  ideaId: string;
  title: string;
  formatType: string;
  targetViewer: string;
  coreThesis: string;
  hookIdea: string;
  whyAngleWorks: string;
  recommendedPlatform: Platform;
  recommendedSourceInsight: string;
  difficultyScore: number;
  estimatedPerformanceScore: number;
}

export interface HookOption {
  text: string;
  strength: number;
}

export interface PlatformCaption {
  platform: Platform | "Instagram Reels";
  caption: string;
}

export interface ScriptCard {
  id: string;
  ideaId: string;
  hookOptions: HookOption[];
  bestHookRecommendation: string;
  talkingPoints: string[];
  specificExamples: string[];
  patternInterruptIdea: string;
  closingLine: string;
  cta: string;
  captionDraft: string;
  platformCaptions: PlatformCaption[];
  notes: string;
  platform: Platform;
  format: string;
  filmed: boolean;
}

export interface AnalyticsEntry {
  id: string;
  contentIdeaId?: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  watchTime: number;
  platform: Platform;
  postedDate: string;
  hookUsed: string;
  formatUsed: string;
}

export interface ReferenceDocument {
  id: "avatar.md" | "scripting-voice.md" | "viral-content-patterns.md" | "hook-swipe-file.md";
  title: string;
  content: string;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  requiredSetup: string;
  status: "Not connected";
  apiKey?: string;
}

export interface CompetitorProfile {
  id: string;
  creatorName: string;
  platform: Platform | "YouTube" | "Instagram";
  profileUrl: string;
  niche: string;
  notes: string;
  examplePostUrls: string;
  observedHooks: string;
  observedFormats: string;
  postingFrequency: string;
  topPerformingNotes: string;
}

export interface CompetitorAnalysis {
  id: string;
  competitorProfileId: string;
  contentPillars: string[];
  hookPatterns: string[];
  formatPatterns: string[];
  postingStrategy: string;
  whatTheyDoWell: string[];
  exploitGaps: string[];
  inspiredIdeas: string[];
}

export interface SavedVideoReference {
  id: string;
  url: string;
  platform: string;
  creator: string;
  whySaved: string;
  hookNotes: string;
  formatNotes: string;
  transcriptPlaceholder: string;
  tags: string;
  createdAt: string;
}

export interface WorkflowAction {
  id: string;
  name: string;
  description: string;
  inputs: string[];
  outputFormat: string;
}

export interface AppData {
  brandProfile: BrandProfile;
  ideas: ContentIdea[];
  variations: ContentVariation[];
  scripts: ScriptCard[];
  analytics: AnalyticsEntry[];
  references: ReferenceDocument[];
  integrations: Integration[];
  competitorProfiles: CompetitorProfile[];
  competitorAnalyses: CompetitorAnalysis[];
  videoReferences: SavedVideoReference[];
  apiKeys: Record<string, string>;
}
