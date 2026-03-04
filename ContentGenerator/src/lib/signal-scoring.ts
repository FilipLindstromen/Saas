/**
 * Signal scoring - ranks content by emotion intensity, relatability, engagement
 * Higher score = better raw material for video questions
 */

// Emotion intensity keywords (personal development pain points)
const EMOTION_KEYWORDS = [
  "overwhelmed",
  "stuck",
  "scared",
  "tired",
  "exhausted",
  "guilty",
  "panic",
  "numb",
  "behind",
  "anxious",
  "burned out",
  "burnout",
  "paralyzed",
  "frozen",
  "spiraling",
  "drowning",
  "breaking",
  "falling apart",
  "can't stop",
  "can't relax",
  "always",
  "never",
  "constantly",
  "every time",
];

// Relatability patterns - questions people actually ask
const RELATABILITY_PATTERNS = [
  /why do i (always|never|constantly)/i,
  /is it normal (to|that|if)/i,
  /am i the only one (who|that)/i,
  /how do you deal with/i,
  /how do (i|you) (stop|handle|cope)/i,
  /does anyone else/i,
  /why can't i/i,
  /i (can't|can) never/i,
  /what do you do when/i,
  /is this (normal|okay|bad)/i,
  /help (me|)?\s*(i'm|im)\s/i,
  /i feel like/i,
  /i'm (so|really) (tired|stuck|overwhelmed)/i,
];

// Safety: exclude content that may indicate self-harm
const SAFETY_EXCLUDE = [
  /suicid/i,
  /kill myself/i,
  /end (my|it) (life|all)/i,
  /self.?harm/i,
  /cutting (myself|)/i,
  /want to die/i,
];

export interface ScoredSignal {
  subreddit: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  permalink: string;
  created_utc: number;
  signalScore: number;
  themeTags: string;
  flagged: boolean;
}

export function computeSignalScore(
  title: string,
  selftext: string,
  score: number,
  numComments: number
): { signalScore: number; themeTags: string; flagged: boolean } {
  let emotionScore = 0;
  let relatabilityScore = 0;

  const text = `${title} ${selftext}`.toLowerCase();

  // Safety check first
  for (const pattern of SAFETY_EXCLUDE) {
    if (pattern.test(text)) {
      return { signalScore: 0, themeTags: "flagged", flagged: true };
    }
  }

  // Emotion intensity
  for (const kw of EMOTION_KEYWORDS) {
    if (text.includes(kw)) emotionScore += 2;
  }

  // Relatability patterns
  for (const pattern of RELATABILITY_PATTERNS) {
    if (pattern.test(text)) relatabilityScore += 5;
  }

  // Engagement (normalize: upvotes + comments)
  const engagementScore = Math.log1p(score + numComments * 2) * 2;

  // Combined score (weighted)
  const signalScore =
    emotionScore * 1.5 + relatabilityScore * 2 + engagementScore;

  // Extract theme tags from keywords found
  const foundThemes = EMOTION_KEYWORDS.filter((kw) => text.includes(kw));
  const themeTags = Array.from(new Set(foundThemes)).slice(0, 5).join(",");

  return {
    signalScore: Math.round(signalScore * 10) / 10,
    themeTags,
    flagged: false,
  };
}
