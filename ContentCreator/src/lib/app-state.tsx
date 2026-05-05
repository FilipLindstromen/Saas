"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { defaultData } from "./constants";
import { loadAppData, resetSeedData, saveAppData } from "./storage";
import {
  AnalyticsEntry,
  AppData,
  CompetitorAnalysis,
  CompetitorProfile,
  ContentIdea,
  ContentVariation,
  SavedVideoReference,
  ScriptCard,
} from "./types";

type AppState = {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  resetData: () => void;
  addIdeas: (ideas: ContentIdea[]) => void;
  removeIdea: (id: string) => void;
  updateIdeaStatus: (id: string, status: ContentIdea["status"]) => void;
  saveVariationAsIdea: (variation: ContentVariation) => void;
  saveScript: (script: ScriptCard) => void;
  addAnalytics: (entry: AnalyticsEntry) => void;
  saveCompetitor: (profile: CompetitorProfile, analysis: CompetitorAnalysis) => void;
  saveVideoReference: (entry: SavedVideoReference) => void;
};

const Context = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const persistAndSetData = useCallback<React.Dispatch<React.SetStateAction<AppData>>>(
    (value) =>
      setData((prev) => {
        const next = typeof value === "function" ? (value as (prev: AppData) => AppData)(prev) : value;
        saveAppData(next);
        return next;
      }),
    [],
  );

  const value = useMemo<AppState>(
    () => ({
      data,
      setData: persistAndSetData,
      resetData: () => {
        resetSeedData();
        persistAndSetData(defaultData);
      },
      addIdeas: (ideas) => persistAndSetData((prev) => ({ ...prev, ideas: [...ideas, ...prev.ideas] })),
      removeIdea: (id) =>
        persistAndSetData((prev) => ({
          ...prev,
          ideas: prev.ideas.filter((idea) => idea.id !== id),
          scripts: prev.scripts.filter((script) => script.ideaId !== id),
          variations: prev.variations.filter((variation) => variation.ideaId !== id),
          analytics: prev.analytics.filter((entry) => entry.contentIdeaId !== id),
        })),
      updateIdeaStatus: (id, status) =>
        persistAndSetData((prev) => ({ ...prev, ideas: prev.ideas.map((idea) => (idea.id === id ? { ...idea, status } : idea)) })),
      saveVariationAsIdea: (variation) =>
        persistAndSetData((prev) => ({
          ...prev,
          ideas: [
            {
              id: variation.id,
              title: variation.title,
              whyTrending: variation.whyAngleWorks,
              source: variation.recommendedSourceInsight,
              selectedSource: "Manual notes",
              audienceSizeScore: 7,
              demoAbilityScore: 7,
              hookPotentialScore: 8,
              suggestedAngle: variation.coreThesis,
              suggestedFormat: variation.formatType,
              recommendedPlatform: variation.recommendedPlatform,
              status: "Ideated",
              hook: variation.hookIdea,
              createdAt: new Date().toISOString(),
            },
            ...prev.ideas,
          ],
        })),
      saveScript: (script) =>
        persistAndSetData((prev) => ({
          ...prev,
          scripts: [script, ...prev.scripts.filter((s) => s.ideaId !== script.ideaId)],
          ideas: prev.ideas.map((idea) => (idea.id === script.ideaId ? { ...idea, status: "Scripted" } : idea)),
        })),
      addAnalytics: (entry) => persistAndSetData((prev) => ({ ...prev, analytics: [entry, ...prev.analytics] })),
      saveCompetitor: (profile, analysis) =>
        persistAndSetData((prev) => ({
          ...prev,
          competitorProfiles: [profile, ...prev.competitorProfiles],
          competitorAnalyses: [analysis, ...prev.competitorAnalyses],
        })),
      saveVideoReference: (entry) => persistAndSetData((prev) => ({ ...prev, videoReferences: [entry, ...prev.videoReferences] })),
    }),
    [data, persistAndSetData],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppState() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
