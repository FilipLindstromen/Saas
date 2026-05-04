import { AnalyticsEntry, ContentIdea } from "./types";

export function calcIdeaScore(idea: ContentIdea) {
  return Math.round((idea.audienceSizeScore + idea.demoAbilityScore + idea.hookPotentialScore) / 3);
}

export function calcEngagementRate(entry: AnalyticsEntry) {
  if (entry.views <= 0) return 0;
  return ((entry.likes + entry.comments + entry.shares + entry.saves) / entry.views) * 100;
}
