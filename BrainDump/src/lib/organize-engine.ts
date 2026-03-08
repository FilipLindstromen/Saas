/**
 * Organization engine: takes a transcript and returns structured items via AI.
 * Keeps business logic separate from UI and API.
 */

export type Domain = "inbox" | "work" | "personal";

export type ItemType =
  | "task"
  | "note"
  | "idea"
  | "emotion"
  | "reflection"
  | "calendar"
  | "problem"
  | "decision"
  | "journal_entry"
  | "project_update";

export interface OrganizedItemInput {
  domain: Domain;
  category: string;
  subcategory: string;
  project_name?: string;
  item_type: ItemType;
  title: string;
  content: string;
  tags?: string[];
  emotion_label?: string;
  recommended_view: string;
  confidence_score: number;
}

const ORGANIZE_SYSTEM_PROMPT = `You are a thought organization assistant. Your job is to analyze a raw transcript (a "brain dump") and split it into structured items.

Rules:
1. Each item has a headline (title) and a description (content). title = short, clear headline (e.g. "Discomfort in the body"). content = the full description: what the user said, verbatim or as a faithful summary. Never leave content empty when the user spoke a full phrase — put their words (or a close paraphrase) in content.
2. Merge related content into ONE entry. Do not split one continuous thought, feeling, or utterance into multiple items. Example: "I feel discomfort in my body, pain, tightness and I don't like it" → one item with title "Discomfort in the body" and content "I feel discomfort in my body, pain, tightness and I don't like it". Only create multiple items when the user clearly switches to a different topic, task, or idea.
3. Split the transcript into multiple items only when it contains distinct topics, tasks, feelings, or ideas. One sentence that expresses one thing = one item.
4. domain is critical — separate personal from work:
   - personal: Hobby projects, creative pursuits the user does for themselves ("personal thing", "not work-related"), how they feel (tired, body feelings, emotional state), reflections about life or wellbeing, personal goals, health, relationships, shopping. If the user says something is a "personal" thing or a "hobby project", it is always personal.
   - work: Work projects, work tasks, professional courses, business/marketing tasks, deliverables for a job or business. If a project name is clearly work (e.g. LumiRush as a product/tool), tasks for that project are work. "Set up a sales page" or "create one video each day for marketing" are work when tied to a work project.
5. item_type is critical:
   - Use "task" ONLY when the user explicitly says something is a task, todo, or something to do (e.g. "add a to-do", "I need to...", "todo: ..."). Do NOT use "task" for general notes or ideas.
   - Use "idea" for ideas, concepts, "I want to..." creative/hobby ideas, method explanations. A hobby project the user "wants to start" (e.g. paint abstract paintings once a week) is an idea under personal.
   - Use "reflection" for how the user feels, body state, tiredness, emotional state, or brief reflections not tied to a project — always use category "feeling" and domain "personal" for these. Do NOT attach these to projects or hobbies.
   - Use "note" for general notes, facts, decisions, updates. When in doubt, use "note".
   - Use "calendar" for time-bound or recurring items (e.g. "every day", "every Monday", "remind me next week", events with a date/time). These appear only in the Calendar view.
6. Personal sections (category for domain=personal): feeling, thoughts, hobbies, goals, health, relationships, shopping.
   - feeling: How the user feels, body state (tired, etc.), emotional state. Use item_type "reflection". Never attach to project_name.
   - hobbies: Hobby projects, personal creative pursuits (e.g. painting, side projects for fun).
   - thoughts: General personal thoughts that don't fit feeling/hobbies/goals/health/relationships/shopping.
   - goals, health, relationships, shopping: Use when content clearly fits.
7. Work: Use category "projects" or "tasks" and set project_name when a work project is named (e.g. LumiRush). Work item_types: task, note, idea, calendar.
8. recommended_view: task_list or kanban for tasks; note_cards for notes; reflection_cards for reflections.
9. confidence_score: 0–1. title: short headline only. content: full description (what the user said); required for every item.

Categories and sections are dynamic. Prefer existing ones when they fit; you MAY create new category names (lowercase, snake_case) when content clearly belongs elsewhere.
When existing_categories are provided below, prefer those.

Respond with a single JSON object: { "items": [ { "domain", "category", "subcategory", "project_name?", "item_type", "title", "content", "tags?", "emotion_label?", "recommended_view", "confidence_score" } ] }
Use only the fields listed. No extra commentary.`;

export interface OrganizeOptions {
  projectNames?: string[];
  defaultDomain?: "work" | "personal" | null;
  /** Existing categories in the DB for this domain (prefer these when they fit). */
  existingCategories?: string[];
  /** User-added category names (e.g. from "Add area"); AI can assign items to these. */
  customCategories?: string[];
}

const DEFAULT_CATEGORIES_WORK = "projects, tasks, notes, ideas, meetings, opportunities";
const DEFAULT_CATEGORIES_PERSONAL = "feeling, thoughts, hobbies, goals, health, relationships, shopping";
const DEFAULT_CATEGORIES_INBOX = "unprocessed, needs_review";

function buildSystemPrompt(options: OrganizeOptions): string {
  let extra = "";
  if (options.projectNames?.length) {
    extra += `\n\nExisting projects (use these exact names when the user mentions them, and store related items under that project): ${options.projectNames.join(", ")}.`;
  }
  if (options.defaultDomain) {
    extra += `\n\nDefault context for this session: "${options.defaultDomain}". When classification is ambiguous, prefer this domain.`;
  }
  const existing = options.existingCategories?.length
    ? options.existingCategories.join(", ")
    : options.defaultDomain === "work"
      ? DEFAULT_CATEGORIES_WORK
      : options.defaultDomain === "personal"
        ? DEFAULT_CATEGORIES_PERSONAL
        : DEFAULT_CATEGORIES_INBOX;
  extra += `\n\nExisting categories (prefer these when they fit): ${existing}.`;
  if (options.customCategories?.length) {
    extra += ` User-added areas to consider: ${options.customCategories.join(", ")}.`;
  }
  return ORGANIZE_SYSTEM_PROMPT + extra;
}

export async function organizeTranscript(
  transcript: string,
  openaiApiKey: string,
  options: OrganizeOptions = {}
): Promise<OrganizedItemInput[]> {
  if (!transcript?.trim()) return [];

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: openaiApiKey || process.env.OPENAI_API_KEY });
  const systemPrompt = buildSystemPrompt(options);

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Transcript:\n\n${transcript}` },
    ],
    temperature: 0.4,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  const text = response.choices?.[0]?.message?.content?.trim();
  if (!text) return [];

  const WORK_ITEM_TYPES = new Set(["task", "note", "idea", "calendar"]);
  const PERSONAL_ITEM_TYPES = new Set(["task", "note", "idea", "emotion", "reflection", "calendar"]);

  function normalizeItemType(domain: string, itemType: string): string {
    if (itemType === "reminder") return "note";
    if (domain === "work") {
      if (WORK_ITEM_TYPES.has(itemType)) return itemType;
      if (itemType === "journal_entry") return "note";
      return "note";
    }
    if (domain === "personal") {
      if (itemType === "emotion") return "reflection"; // "How I feel" → reflection under feeling
      if (PERSONAL_ITEM_TYPES.has(itemType)) return itemType;
      if (itemType === "journal_entry") return "reflection";
      return "note";
    }
    return itemType;
  }

  function normalizeCategory(domain: string, category: string): string {
    if (domain === "personal" && (category === "feelings" || category === "emotions")) return "feeling";
    return category ?? "";
  }

  try {
    const parsed = JSON.parse(text) as { items?: OrganizedItemInput[] };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return items.map((item) => {
      const domain = item.domain ?? "inbox";
      const rawType = item.item_type ?? "note";
      const item_type = normalizeItemType(domain, rawType) as ItemType;
      const category = normalizeCategory(domain, item.category ?? "");
      return {
        ...item,
        item_type,
        category,
        subcategory: item.subcategory ?? "",
        confidence_score: typeof item.confidence_score === "number" ? item.confidence_score : 0.8,
        recommended_view: item.recommended_view ?? "note_cards",
      };
    });
  } catch {
    return [];
  }
}
