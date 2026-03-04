/**
 * OpenAI-based video question and hook generator
 */

import OpenAI from "openai";
import {
  buildUserPrompt,
  SYSTEM_PROMPT,
  type GenerationSettings,
  type SignalInput,
} from "./prompt-builder";
import { cacheGet, cacheSet, cacheKey } from "./cache";

export interface GeneratedQuestion {
  question: string;
  theme: string;
  tags: string[];
  hooks: string[];
  why_it_works: string;
}

export interface GenerationResult {
  questions: GeneratedQuestion[];
  safety_note?: string;
}

export async function generateQuestions(
  settings: GenerationSettings,
  signals: SignalInput[],
  apiKey?: string
): Promise<GenerationResult> {
  const key = apiKey?.trim() || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OpenAI API key is required. Add it in Settings or set OPENAI_API_KEY in .env");
  }

  const openai = new OpenAI({ apiKey: key });
  // Check cache
  const cacheKeyStr = cacheKey("gen", {
    audience: settings.audience,
    theme: settings.theme,
    tone: settings.tone,
    format: settings.format,
    intensity: settings.intensity,
    context: settings.context,
    numQuestions: settings.numQuestions,
    generateHooks: settings.generateHooks,
    signalTitles: signals.map((s) => s.title).slice(0, 10),
  });
  const cached = cacheGet<GenerationResult>(cacheKeyStr);
  if (cached) return cached;

  const userPrompt = buildUserPrompt(settings, signals);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  // Parse and validate
  let parsed: { questions?: unknown[]; safety_note?: string };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Invalid JSON from OpenAI");
  }

  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  const safetyNote = typeof parsed.safety_note === "string" ? parsed.safety_note : undefined;

  const result: GenerationResult = {
    questions: questions.map((q: unknown) => {
      const qq = q as Record<string, unknown>;
      return {
        question: String(qq?.question ?? ""),
        theme: String(qq?.theme ?? ""),
        tags: Array.isArray(qq?.tags) ? qq.tags.map(String) : [],
        hooks: Array.isArray(qq?.hooks) ? qq.hooks.map(String) : [],
        why_it_works: String(qq?.why_it_works ?? ""),
      };
    }),
    ...(safetyNote && { safety_note: safetyNote }),
  };

  cacheSet(cacheKeyStr, result);
  return result;
}
