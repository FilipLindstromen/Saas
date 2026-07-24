import { prisma } from "@/lib/db";
import { ensureSiteSettingsSchema } from "@/lib/ensure-site-settings-schema";
import {
  DEFAULT_ORGANIZE_SYSTEM_PROMPT_EN,
  DEFAULT_ORGANIZE_SYSTEM_PROMPT_SV,
} from "@/lib/organize-engine";
import { DEFAULT_COACH_SYSTEM_PROMPT } from "@/lib/coach-instructions-defaults";

const GLOBAL_ID = "global";

export type AiInstructionOverrides = {
  organizeSystemPromptEn: string | null;
  organizeSystemPromptSv: string | null;
  coachSystemPrompt: string | null;
};

export type AiInstructionDefaults = {
  organizeSystemPromptEn: string;
  organizeSystemPromptSv: string;
  coachSystemPrompt: string;
};

export function getAiInstructionDefaults(): AiInstructionDefaults {
  return {
    organizeSystemPromptEn: DEFAULT_ORGANIZE_SYSTEM_PROMPT_EN,
    organizeSystemPromptSv: DEFAULT_ORGANIZE_SYSTEM_PROMPT_SV,
    coachSystemPrompt: DEFAULT_COACH_SYSTEM_PROMPT,
  };
}

export async function getAiInstructionOverrides(): Promise<AiInstructionOverrides> {
  await ensureSiteSettingsSchema(prisma);
  const row = await prisma.siteSettings.findUnique({ where: { id: GLOBAL_ID } });
  return {
    organizeSystemPromptEn: row?.organizeSystemPromptEn ?? null,
    organizeSystemPromptSv: row?.organizeSystemPromptSv ?? null,
    coachSystemPrompt: row?.coachSystemPrompt ?? null,
  };
}

export async function setAiInstructionOverrides(
  patch: Partial<{
    organizeSystemPromptEn: string | null;
    organizeSystemPromptSv: string | null;
    coachSystemPrompt: string | null;
  }>
): Promise<void> {
  const data: {
    organizeSystemPromptEn?: string | null;
    organizeSystemPromptSv?: string | null;
    coachSystemPrompt?: string | null;
  } = {};

  if ("organizeSystemPromptEn" in patch) {
    data.organizeSystemPromptEn = normalizePromptPatch(patch.organizeSystemPromptEn);
  }
  if ("organizeSystemPromptSv" in patch) {
    data.organizeSystemPromptSv = normalizePromptPatch(patch.organizeSystemPromptSv);
  }
  if ("coachSystemPrompt" in patch) {
    data.coachSystemPrompt = normalizePromptPatch(patch.coachSystemPrompt);
  }

  if (Object.keys(data).length === 0) return;

  await ensureSiteSettingsSchema(prisma);
  await prisma.siteSettings.upsert({
    where: { id: GLOBAL_ID },
    create: { id: GLOBAL_ID, ...data },
    update: data,
  });
}

function normalizePromptPatch(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveOrganizeSystemPromptBase(
  locale: "en" | "sv",
  overrides: AiInstructionOverrides
): string {
  const custom =
    locale === "sv" ? overrides.organizeSystemPromptSv : overrides.organizeSystemPromptEn;
  if (custom?.trim()) return custom.trim();
  return locale === "sv" ? DEFAULT_ORGANIZE_SYSTEM_PROMPT_SV : DEFAULT_ORGANIZE_SYSTEM_PROMPT_EN;
}

export function resolveCoachSystemPromptBase(overrides: AiInstructionOverrides): string {
  return overrides.coachSystemPrompt?.trim() || DEFAULT_COACH_SYSTEM_PROMPT;
}
