/**
 * Organization engine: takes a transcript and returns structured items via AI.
 * Keeps business logic separate from UI and API.
 */

import { normalizeReminderMinutesBefore } from "./calendar-schedule";

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
  /** Calendar (item_type calendar): YYYY-MM-DD in user's locale relative to reference time */
  scheduled_date?: string;
  /** Calendar: HH:mm 24h local */
  scheduled_time?: string;
  /** none | daily | weekly | monthly */
  recurrence?: string;
  /** Whether to enable notifications for this event */
  send_notification?: boolean;
  /** Minutes before event for an advance notification: 0 (none), 10, 30, or 60 only */
  reminder_minutes_before?: number;
}

const ORGANIZE_SYSTEM_PROMPT = `You are a thought organization assistant. Your job is to analyze a raw transcript (a "brain dump") and split it into structured items.

Rules:
1. Each item has a headline (title) and a description (content). title = short, clear headline (e.g. "Discomfort in the body"). content = the full description: what the user said, verbatim or as a faithful summary. Never leave content empty when the user spoke a full phrase — put their words (or a close paraphrase) in content.
2. Merge related content into ONE entry. Do not split one continuous thought, feeling, or utterance into multiple items. Example: "I feel discomfort in my body, pain, tightness and I don't like it" → one item with title "Discomfort in the body" and content "I feel discomfort in my body, pain, tightness and I don't like it". Only create multiple items when the user clearly switches to a different topic, task, or idea.
3. Split the transcript into multiple items only when it contains distinct topics, tasks, feelings, or ideas. One sentence that expresses one thing = one item.
4. domain is critical — separate personal from work:
   - personal: Hobby projects, creative pursuits the user does for themselves ("personal thing", "not work-related"), how they feel (tired, body feelings, emotional state), reflections about life or wellbeing, personal goals, health, relationships, shopping. If the user says something is a "personal" thing or a "hobby project", it is always personal.
   - work: Work projects, work tasks, professional courses, business/marketing tasks, deliverables for a job or business. If a project name is clearly work (e.g. LumiRush as a product/tool), tasks for that project are work. "Set up a sales page" or "create one video each day for marketing" are work when tied to a work project.
   - If a task does not mention a specific work project and has no clear work context, classify it as personal (e.g. home errands like changing windshield wipers).
5. item_type is critical:
   - Use "task" ONLY when the user explicitly says something is a task, todo, or something to do (e.g. "add a to-do", "I need to...", "todo: ..."). Do NOT use "task" for general notes or ideas.
   - Use "idea" for ideas, concepts, "I want to..." creative/hobby ideas, method explanations. A hobby project the user "wants to start" (e.g. paint abstract paintings once a week) is an idea under personal.
   - Use "reflection" for how the user feels, body state, tiredness, emotional state, or brief reflections not tied to a project — always use category "feeling" and domain "personal" for these. Do NOT attach these to projects or hobbies.
   - Use "note" for general notes, facts, decisions, updates. When in doubt, use "note".
   - Use "calendar" for time-bound or recurring items (e.g. "every day", "every Monday", "remind me next week", events with a date/time). These appear only in the Calendar view.
   - For EVERY item with item_type "calendar", you MUST extract scheduling from the transcript:
     - scheduled_date: YYYY-MM-DD using the reference date/time below to interpret "today", "tomorrow", "next Friday", "March 20", etc.
     - scheduled_time: HH:mm in 24-hour local time (e.g. 14:00 for 2pm). If the user says "at 2pm" use 14:00; "9 in the morning" → 09:00. If no time is mentioned, use a reasonable default (09:00) or omit only if truly all-day with no time.
     - recurrence: "none" unless the user clearly said daily/weekly/monthly recurrence; then "daily", "weekly", or "monthly".
     - send_notification: true if the user wants a reminder or notification for this event; false otherwise.
     - reminder_minutes_before: if send_notification is true, pick exactly one of: 60 (one hour before), 30 (half an hour before), 10 (ten minutes before), or 0 (notify at event time only, no advance ping). Match the user's wording when possible.
6. Personal sections (category for domain=personal): feeling, thoughts, hobbies, goals, health, relationships, shopping.
   - feeling: How the user feels, body state (tired, etc.), emotional state. Use item_type "reflection". Never attach to project_name.
   - hobbies: Hobby projects, personal creative pursuits (e.g. painting, side projects for fun).
   - thoughts: General personal thoughts that don't fit feeling/hobbies/goals/health/relationships/shopping.
   - goals, health, relationships, shopping: Use when content clearly fits.
7. Work: Use category "projects" or "tasks" and set project_name when a work project is named (e.g. LumiRush). Work item_types: task, note, idea, calendar.
   If the user names a project that is not in the "Existing projects" list, still set project_name to that name — the app will create the project automatically. Never omit project_name only because the project is new.
8. recommended_view: task_list or kanban for tasks; note_cards for notes; reflection_cards for reflections.
9. confidence_score: 0–1. title: short headline only. content: full description (what the user said); required for every item.

Categories and sections are dynamic. Prefer existing ones when they fit; you MAY create new category names (lowercase, snake_case) when content clearly belongs elsewhere.
When existing_categories are provided below, prefer those.

Respond with a single JSON object: { "items": [ { "domain", "category", "subcategory", "project_name?", "item_type", "title", "content", "tags?", "emotion_label?", "recommended_view", "confidence_score" } ] }
Use only the fields listed. No extra commentary.`;

const ORGANIZE_SYSTEM_PROMPT_SV = `Du är en assistent för att organisera tankar. Din uppgift är att analysera ett rått transkript (en "brain dump") och dela upp det i strukturerade poster.

Regler:
1. Varje post har en rubrik (title) och en beskrivning (content). title = kort, tydlig rubrik. content = full beskrivning: vad användaren sa, ordagrant eller troget sammanfattat. Lämna aldrig content tom när användaren sagt en hel mening — lägg deras ord (eller nära omformulering) i content.
2. Slå ihop närhörande innehåll till EN post. Dela inte en sammanhängande tanke, känsla eller yttrande i flera poster. Skapa flera poster bara när användaren tydligt byter ämne, uppgift eller idé.
3. Dela transkriptet i flera poster bara när det innehåller skilda ämnen, uppgifter, känslor eller idéer. En mening som uttrycker en sak = en post.
4. domain är avgörande — skilj privat från arbete:
   - personal: Hobbyprojekt, kreativa sysslor för sig själv ("privat", "inte jobbrelaterat"), hur man mår (trött, kropp, känsla), reflektioner om liv eller välmående, personliga mål, hälsa, relationer, shopping. Om användaren säger att något är "privat" eller hobby, ska det alltid vara personal.
   - work: Arbetsprojekt, arbetsuppgifter, yrkeskurser, affärs-/marknadsföringsuppgifter, leveranser för jobb eller företag. Om ett projektnamn tydligt är arbete, är uppgifter för det projektet work. "Sätt upp en säljlanding" eller "gör en video om dagen för marknadsföring" är work när det kopplas till ett arbetsprojekt.
   - Om en uppgift inte nämner ett specifikt arbetsprojekt och saknar tydlig arbetskontext, klassificera den som personal (t.ex. hemmaärenden som att byta vindrutetorkare).
5. item_type är avgörande:
   - Använd "task" ENDAST när användaren uttryckligen säger att något är en uppgift, todo eller något att göra. Använd INTE "task" för allmänna anteckningar eller idéer.
   - Använd "idea" för idéer, koncept, "jag vill..." kreativa/hobbyidéer. Ett hobbyprojekt användaren "vill börja med" är en idea under personal.
   - Använd "reflection" för hur användaren mår, kroppstillstånd, trötthet, känsloläge, eller korta reflektioner utan projekt — använd alltid category "feeling" och domain "personal". Koppla INTE dessa till projekt eller hobbies.
   - Använd "note" för allmänna anteckningar, fakta, beslut, uppdateringar. Vid tvekan, använd "note".
   - Använd "calendar" för tidsbundna eller återkommande saker (t.ex. "varje dag", "varje måndag", "påminn mig nästa vecka", händelser med datum/tid).
   - För varje post med item_type "calendar": extrahera schemaläggning från transkriptet:
     - scheduled_date: YYYY-MM-DD med referensdatum/tid nedan för "idag", "imorgon", "nästa fredag", osv.
     - scheduled_time: HH:mm i 24-timmarsformat lokalt (t.ex. 14:00 för "klockan 2", "klockan 14"). Om ingen tid nämns, rimlig standard (09:00) eller utelämna bara vid heldag utan tid.
     - recurrence: "none" om inte användaren sagt daglig/veckovis/månadsvis upprepning.
     - send_notification: true om användaren vill ha påminnelse/notis.
     - reminder_minutes_before: om send_notification är true, exakt ett av: 60, 30, 10, eller 0 (endast vid starttid, ingen tidigare notis).
6. Personliga sektioner (category för domain=personal): feeling, thoughts, hobbies, goals, health, relationships, shopping.
   - feeling: Hur användaren mår, kropp, känsla. Använd item_type "reflection". Koppla aldrig till project_name.
   - hobbies: Hobbyprojekt, personlig kreativitet (t.ex. målning, sidoprojekt för nöje).
   - thoughts: Allmänna personliga tankar som inte passar feeling/hobbies/goals/health/relationships/shopping.
   - goals, health, relationships, shopping: Använd när innehållet tydligt passar.
7. Work: Använd category "projects" eller "tasks" och sätt project_name när ett arbetsprojekt nämns. Work item_types: task, note, idea, calendar.
   Om användaren nämner ett projekt som inte finns i listan "Befintliga projekt", sätt ändå project_name till det namnet — appen skapar projektet. Utelämna aldrig project_name bara för att projektet är nytt.
8. recommended_view: task_list eller kanban för tasks; note_cards för notes; reflection_cards för reflections.
9. confidence_score: 0–1. title: kort rubrik. content: full beskrivning; krävs för varje post.

Fältnamn domain, category, item_type osv ska vara på engelska som i schemat nedan. Värden i title och content ska vara på svenska när användaren pratat svenska.

Kategorier är dynamiska. Föredra befintliga när de passar; du FÅR skapa nya category-namn (lowercase, snake_case) när innehållet tydligt passar någon annanstans.
När befintliga kategorier listas nedan, föredra dem.

Svara med ett enda JSON-objekt: { "items": [ { "domain", "category", "subcategory", "project_name?", "item_type", "title", "content", "tags?", "emotion_label?", "recommended_view", "confidence_score", "scheduled_date?", "scheduled_time?", "recurrence?", "send_notification?", "reminder_minutes_before?" } ] }
För calendar-poster: inkludera scheduled_date och scheduled_time när användaren gett datum eller tid. Använd bara listade fält. Ingen extra kommentar.`;

export interface OrganizeOptions {
  projectNames?: string[];
  defaultDomain?: "work" | "personal" | null;
  /** Existing categories in the DB for this domain (prefer these when they fit). */
  existingCategories?: string[];
  /** User-added category names (e.g. from "Add area"); AI can assign items to these. */
  customCategories?: string[];
  /** UI locale — Swedish prompts and Swedish titles/content in output when "sv". */
  locale?: "en" | "sv";
  /** Client "now" (ISO string) so the model can resolve "today" / "tomorrow" for calendar fields. */
  referenceIso?: string;
}

const DEFAULT_CATEGORIES_WORK = "projects, tasks, notes, ideas, meetings, opportunities";
const DEFAULT_CATEGORIES_PERSONAL = "feeling, thoughts, hobbies, goals, health, relationships, shopping";
const DEFAULT_CATEGORIES_INBOX = "unprocessed, needs_review";

function buildSystemPrompt(options: OrganizeOptions): string {
  const sv = options.locale === "sv";
  const base = sv ? ORGANIZE_SYSTEM_PROMPT_SV : ORGANIZE_SYSTEM_PROMPT;
  let extra = "";
  if (options.projectNames?.length) {
    extra += sv
      ? `\n\nBefintliga projekt (använd exakt dessa namn när användaren nämner dem, koppla poster till projektet): ${options.projectNames.join(", ")}.`
      : `\n\nExisting projects (use these exact names when the user mentions them, and store related items under that project): ${options.projectNames.join(", ")}.`;
  }
  if (options.defaultDomain) {
    extra += sv
      ? `\n\nStandardkontext för denna session: "${options.defaultDomain}". Vid tvekan om klassificering, föredra denna domain.`
      : `\n\nDefault context for this session: "${options.defaultDomain}". When classification is ambiguous, prefer this domain.`;
  }
  const existing = options.existingCategories?.length
    ? options.existingCategories.join(", ")
    : options.defaultDomain === "work"
      ? DEFAULT_CATEGORIES_WORK
      : options.defaultDomain === "personal"
        ? DEFAULT_CATEGORIES_PERSONAL
        : DEFAULT_CATEGORIES_INBOX;
  extra += sv
    ? `\n\nBefintliga kategorier (föredra när de passar): ${existing}.`
    : `\n\nExisting categories (prefer these when they fit): ${existing}.`;
  if (options.customCategories?.length) {
    extra += sv
      ? ` Användardefinierade områden att överväga: ${options.customCategories.join(", ")}.`
      : ` User-added areas to consider: ${options.customCategories.join(", ")}.`;
  }
  return base + extra;
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
  const locale = options.locale ?? "en";
  const ref =
    options.referenceIso?.trim() ||
    new Date().toISOString();
  const refLine =
    locale === "sv"
      ? `\n\nReferensdatum/tid (användarens "nu" för att tolka idag/imorgon): ${ref}`
      : `\n\nReference date/time (user's "now" for interpreting today/tomorrow): ${ref}`;

  const userContent =
    locale === "sv"
      ? `Transkript:\n\n${transcript}${refLine}\n\nSkriv title och content på svenska för varje post (om transkriptet är på svenska).`
      : `Transcript:\n\n${transcript}${refLine}`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
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

  function shouldTreatAsWorkTask(item: OrganizedItemInput): boolean {
    const text = `${item.title ?? ""} ${item.content ?? ""}`.toLowerCase();
    const enWork =
      /\b(work|job|office|client|meeting|sprint|deadline|ticket|deploy|repo|code|marketing|sales|campaign|boss|team|company|business)\b/.test(
        text
      );
    const svWork =
      /\b(arbete|jobb|kontor|kund|möte|deadline|sprint|marknadsföring|försäljning|kampanj|chef|team|företag|affär)\b/.test(
        text
      );
    const hasWorkKeyword = enWork || svWork;
    const mentionsKnownProject = (options.projectNames ?? []).some((p) => text.includes(p.toLowerCase()));
    return hasWorkKeyword || mentionsKnownProject;
  }

  function pickStr(raw: Record<string, unknown>, ...keys: string[]): string | undefined {
    for (const k of keys) {
      const v = raw[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return undefined;
  }

  function pickBool(raw: Record<string, unknown>, ...keys: string[]): boolean | undefined {
    for (const k of keys) {
      const v = raw[k];
      if (typeof v === "boolean") return v;
    }
    return undefined;
  }

  try {
    const parsed = JSON.parse(text) as { items?: OrganizedItemInput[] };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return items.map((item) => {
      const raw = item as unknown as Record<string, unknown>;
      const mergedProjectName =
        (typeof raw.project_name === "string" && raw.project_name.trim()) ||
        (typeof raw.project === "string" && raw.project.trim()) ||
        (typeof raw.projectName === "string" && raw.projectName.trim()) ||
        "";

      let domain = item.domain ?? "inbox";
      const rawType = item.item_type ?? "note";
      const item_type = normalizeItemType(domain, rawType) as ItemType;
      const hasProjectName = mergedProjectName.length > 0;
      // Guardrail: ambiguous non-project tasks should default to personal unless clearly work.
      if (
        domain === "work" &&
        item_type === "task" &&
        !hasProjectName &&
        options.defaultDomain !== "work" &&
        !shouldTreatAsWorkTask(item)
      ) {
        domain = "personal";
      }
      const category = normalizeCategory(domain, item.category ?? "");
      const normalizedCategory =
        domain === "personal" && item_type === "task" && (!category || category === "projects")
          ? "tasks"
          : category;

      let scheduled_date = pickStr(raw, "scheduled_date", "scheduledDate");
      let scheduled_time = pickStr(raw, "scheduled_time", "scheduledTime");
      const recurrenceRaw = pickStr(raw, "recurrence");
      const send_notification = pickBool(raw, "send_notification", "sendNotification");
      const reminderRaw = raw.reminder_minutes_before ?? raw.reminderMinutesBefore;

      if (item_type === "calendar" && scheduled_time && /^\d{1,2}:\d{2}$/.test(scheduled_time)) {
        const [h, m] = scheduled_time.split(":");
        scheduled_time = `${h!.padStart(2, "0")}:${m!}`;
      }

      const reminder_minutes_before =
        item_type === "calendar" ? normalizeReminderMinutesBefore(reminderRaw) : undefined;

      const recurrenceOut =
        recurrenceRaw && ["daily", "weekly", "monthly"].includes(recurrenceRaw) ? recurrenceRaw : undefined;

      const base: OrganizedItemInput = {
        ...item,
        project_name: mergedProjectName || undefined,
        domain,
        item_type,
        category: normalizedCategory,
        subcategory: item.subcategory ?? "",
        confidence_score: typeof item.confidence_score === "number" ? item.confidence_score : 0.8,
        recommended_view: item.recommended_view ?? "note_cards",
      };

      if (item_type === "calendar") {
        if (scheduled_date) base.scheduled_date = scheduled_date;
        if (scheduled_time) base.scheduled_time = scheduled_time;
        if (recurrenceOut) base.recurrence = recurrenceOut;
        if (send_notification === true) {
          base.send_notification = true;
          base.reminder_minutes_before =
            reminder_minutes_before === 0 ? 0 : reminder_minutes_before || 30;
        } else if (send_notification === false) {
          base.send_notification = false;
        }
      }

      return base;
    });
  } catch {
    return [];
  }
}
