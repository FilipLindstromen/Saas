"use server";

/**
 * Server action: Generate video questions from top signals using OpenAI
 */
import { prisma } from "@/lib/db";
import { generateQuestions as runGenerator } from "@/lib/openai-generator";
import type { GenerationSettings } from "@/lib/prompt-builder";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

export interface GenerateInput {
  audience: string;
  theme: string;
  tone: string[];
  format: string[];
  platform: string[];
  intensity: "soft" | "medium" | "direct";
  context?: string;
  numQuestions: number;
  generateHooks: boolean;
  topN?: number;
  saveToLibrary?: boolean;
  /** OpenAI API key from shared storage (client passes this) */
  apiKey?: string;
}

export interface GenerateResult {
  success: boolean;
  questions?: Array<{
    question: string;
    theme: string;
    tags: string[];
    hooks: string[];
    why_it_works: string;
  }>;
  safety_note?: string;
  promptPreview?: string;
  error?: string;
}

export async function generateQuestions(input: GenerateInput): Promise<GenerateResult> {
  // Rate limit by IP
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? "anonymous";
  const { ok } = rateLimit(ip);
  if (!ok) {
    return { success: false, error: "Rate limit exceeded. Please try again in a minute." };
  }

  const topN = input.topN ?? 30;
  const saveToLibrary = input.saveToLibrary ?? true;

  try {
    // Fetch top signals (excluding flagged)
    const signals = await prisma.signal.findMany({
      where: { flagged: false },
      orderBy: { signalScore: "desc" },
      take: topN,
      include: {
        comments: { orderBy: { score: "desc" }, take: 5 },
      },
    });

    if (signals.length === 0) {
      return {
        success: false,
        error: "No signals found. Run 'Scan Reddit' first to collect pain-point content.",
      };
    }

    const settings: GenerationSettings = {
      audience: input.audience,
      theme: input.theme,
      tone: input.tone,
      format: input.format,
      platform: input.platform,
      intensity: input.intensity,
      context: input.context,
      numQuestions: input.numQuestions,
      generateHooks: input.generateHooks,
    };

    const signalInputs = signals.map((s) => ({
      title: s.title,
      selftext: s.selftext,
      permalink: s.permalink,
      comments: s.comments.map((c) => c.body),
      score: s.score,
      numComments: s.numComments,
    }));

    const result = await runGenerator(settings, signalInputs, input.apiKey);

    if (saveToLibrary && result.questions.length > 0) {
      await prisma.generatedResult.create({
        data: {
          questions: JSON.stringify(result.questions),
          settings: JSON.stringify(settings),
          signalIds: signals.map((s) => s.id).join(","),
        },
      });
    }

    return {
      success: true,
      questions: result.questions,
      ...(result.safety_note && { safety_note: result.safety_note }),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}
