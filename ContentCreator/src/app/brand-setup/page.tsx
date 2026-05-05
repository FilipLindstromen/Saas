"use client";

import { useAppState } from "@/lib/app-state";
import { Card, V1Badge } from "@/components/app-shell";

const fields = [
  ["businessName", "Business name"], ["whatIDo", "What I do"], ["platformsAndHandles", "Platforms and handles"], ["nicheKeywords", "Niche keywords"],
  ["brandVoice", "Brand voice"], ["alwaysRules", "Always rules"], ["neverRules", "Never rules"], ["audienceDescription", "Audience description"],
  ["speakingStyle", "Speaking style"], ["ctaPreferences", "CTA preferences"], ["contentPillars", "Content pillars"], ["offerDescription", "Offer/product description"],
  ["preferredVideoFormats", "Preferred video formats"], ["noGoTopics", "Things to avoid"],
] as const;

export default function BrandSetupPage() {
  const { data, setData } = useAppState();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Brand Setup</h2><V1Badge /></div>
      <Card title="Reusable Brand Profile" subtitle="Used by research, multiply, and script generators.">
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map(([key, label]) => (
            <label key={key} className="text-sm">
              <span className="cc-muted mb-1 block">{label}</span>
              <textarea className="cc-textarea min-h-24" value={data.brandProfile[key]} onChange={(e) => setData((prev) => ({ ...prev, brandProfile: { ...prev.brandProfile, [key]: e.target.value } }))} />
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}

