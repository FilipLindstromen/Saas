/**
 * Organization engine: takes a transcript and returns structured items via AI.
 * Keeps business logic separate from UI and API.
 * Prompts and catalog labels live in organize-instructions.json (edit that file to tune behavior).
 */

import organizeInstructions from "./organize-instructions.json";
import { normalizeReminderMinutesBefore } from "./calendar-schedule";
import {
  filterNewStandaloneProjectNames,
  resolveProjectNameToCanonical,
  extractExplicitWorkProjectNames,
  filterRedundantProjectCreationNotes,
} from "./project-name-match";
import { PERSONAL_AREA_DEFAULTS } from "./personal-areas";

export type Domain = "inbox" | "work" | "personal";

export type ItemType =
  | "task"
  | "task_completed"
  | "shopping"
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
   - Use "shopping" for things to buy or get from a store: groceries, clothes, household items, phrases like "I need to shop", "buy socks", "pick up milk", "get from the store". Prefer "shopping" over "task" when the action is purchasing goods (e.g. "I need to shop socks tomorrow" → item_type "shopping", not "task"). Use domain "personal" and category "shopping" unless it is clearly work-related procurement (office supplies for work → domain "work", category "shopping"). When the user says when to shop (e.g. "tomorrow", "today", "next Saturday"), set shopping_due_date to YYYY-MM-DD using the reference date/time below (e.g. "tomorrow" = the calendar day after the reference date).
   - Use "calendar" for time-bound or recurring items (e.g. "every day", "every Monday", "remind me next week", events with a date/time). These appear only in the Calendar view.
   - For EVERY item with item_type "calendar", you MUST extract scheduling from the transcript:
     - scheduled_date: YYYY-MM-DD using the reference date/time below to interpret "today", "tomorrow", "next Friday", "March 20", etc.
     - scheduled_time: HH:mm in 24-hour local time (e.g. 14:00 for 2pm). If the user says "at 2pm" use 14:00; "9 in the morning" → 09:00. If no time is mentioned, use a reasonable default (09:00) or omit only if truly all-day with no time.
     - recurrence: "none" unless the user clearly said daily/weekly/monthly recurrence; then "daily", "weekly", or "monthly".
     - send_notification: true if the user wants a reminder or notification for this event; false otherwise.
     - reminder_minutes_before: if send_notification is true, pick exactly one of: 60 (one hour before), 30 (half an hour before), 10 (ten minutes before), or 0 (notify at event time only, no advance ping). Match the user's wording when possible.
6. Personal areas (category when domain=personal; use snake_case from the merged list at the end of this prompt when possible):
   - feeling: Momentary mood, body sensations, tiredness, emotional snapshots. Use item_type "reflection". Never attach to project_name.
   - wellbeing: Ongoing mental wellness, self-care, mindfulness, therapy homework, boundaries, sustainable habits (not a one-off mood — use feeling for that).
   - relationships: Partner, family, friends, social connection, interpersonal conflict or support.
   - health_fitness: Exercise, sport, nutrition, sleep as a goal, doctors, dentists, medical follow-ups, training plans.
   - thoughts: General personal thoughts when no more specific area fits.
   - hobbies: Creative leisure and fun side projects (not for income).
   - goals: Personal aspirations and life milestones outside work.
   - learning: Books, courses, languages, skills for personal growth (job training → work).
   - finance: Personal money, budget, savings, bills, subscriptions.
   - home: Household, living space, chores, repairs (things to buy → shopping).
   - travel: Trips, vacations, transport plans.
   - shopping: Things to buy (groceries, clothes, household goods).
7. Work: Use category "projects" or "tasks" and set project_name when a work project is named (e.g. LumiRush). Work item_types: task, note, idea, calendar, shopping (only for clear work procurement).
   If the user names a project that is not in the "Existing projects" list, still set project_name to that name — the app will create the project automatically. Never omit project_name only because the project is new.
   When "Existing projects" is listed below, you MUST match the user's speech to one of those names whenever it is the same real project (see rule 10). Do not output a new spelling that differs only slightly.
8. recommended_view: task_list or kanban for tasks; note_cards for notes, ideas, and shopping; reflection_cards for reflections.
9. confidence_score: 0–1. title: short headline only. content: full description (what the user said); required for every item.
10. Existing work projects (when listed below): This list is the source of truth for work project names.
   - Before setting project_name on ANY work item, decide if the user meant one of these projects. Match despite: typos, missing spaces, extra spoken words like "and" in the middle of a name (e.g. speech "Relax and experience" → same as listed "Relaxperience"), abbreviations, or different capitalization.
   - When it is the same project, set project_name to the EXACT string from the list, character-for-character.
   - Never output a near-duplicate name (e.g. if the list has "Relaxperience", do NOT use "Relaxandexperience", "Relax Experience", or "Relaxandexperiance").
   - If unsure between two listed projects, pick the closest list match; do not invent a third spelling.
11. Explicit "create project" only: If the user mainly wants to register an empty work project (e.g. "Create a project called X", "Create a project caled X", "New project named Y", "Add a work project Z", "Skapa ett projekt som heter X") and is NOT also describing substantive tasks, notes, or ideas to store, then:
   - Put ONLY the new project name(s) in "standalone_project_creations" (array of strings).
   - Set "items" to [] (empty array). Do NOT create a note, idea, or task that only repeats the project-creation request or echoes the project name without other work content.
   If the same utterance ALSO contains real tasks, meeting notes, or ideas unrelated to the shell project, put those in "items" as usual AND still add standalone_project_creations for any brand-new project shell(s) that have no items yet.

Categories and sections are dynamic. Prefer existing ones when they fit; you MAY create new category names (lowercase, snake_case) when content clearly belongs elsewhere.
When existing_categories are provided below, prefer those.

Respond with a single JSON object:
{ "items": [ ... ], "standalone_project_creations"?: string[] }
Each "items" element: { "domain", "category", "subcategory", "project_name?", "item_type", "title", "content", "tags?", "emotion_label?", "recommended_view", "confidence_score", "task_due_date?", "shopping_due_date?", "scheduled_date?", "scheduled_time?", "recurrence?", "send_notification?", "reminder_minutes_before?" }
For tasks with a due day, include task_due_date (YYYY-MM-DD). For shopping items with a planned day, include shopping_due_date (YYYY-MM-DD). For calendar items, include scheduled_date and related fields as in the rules above.
standalone_project_creations: array of strings (work project names to create as empty projects), per rule 11. Omit the key or use [] if none.
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
   - Använd "shopping" för saker att köpa: mat, kläder, "jag måste handla", "köpa strumpor", "handla imorgon". Föredra "shopping" framför "task" när det handlar om att köpa varor (t.ex. "handla strumpor imorgon" → shopping). Använd domain "personal" och category "shopping" om det inte tydligt är inköp för jobbet. När användaren säger när (t.ex. "imorgon", "idag"), sätt shopping_due_date till YYYY-MM-DD med referensdatum nedan ("imorgon" = dagen efter referensdatum).
   - Använd "calendar" för tidsbundna eller återkommande saker (t.ex. "varje dag", "varje måndag", "påminn mig nästa vecka", händelser med datum/tid).
   - För varje post med item_type "calendar": extrahera schemaläggning från transkriptet:
     - scheduled_date: YYYY-MM-DD med referensdatum/tid nedan för "idag", "imorgon", "nästa fredag", osv.
     - scheduled_time: HH:mm i 24-timmarsformat lokalt (t.ex. 14:00 för "klockan 2", "klockan 14"). Om ingen tid nämns, rimlig standard (09:00) eller utelämna bara vid heldag utan tid.
     - recurrence: "none" om inte användaren sagt daglig/veckovis/månadsvis upprepning.
     - send_notification: true om användaren vill ha påminnelse/notis.
     - reminder_minutes_before: om send_notification är true, exakt ett av: 60, 30, 10, eller 0 (endast vid starttid, ingen tidigare notis).
6. Personliga områden (category när domain=personal; använd snake_case från den sammanslagna listan längst ned i prompten när det går):
   - feeling: Stämningsläge, kroppskänsla, trötthet, känsla i stunden. Använd item_type "reflection". Koppla aldrig till project_name.
   - wellbeing: Långsiktigt välmående, egenvård, mindfulness, terapi, gränser, hållbara vanor (inte enstaka humör → feeling).
   - relationships: Partner, familj, vänner, socialt liv, konflikt eller stöd mellan människor.
   - health_fitness: Träning, sport, kost, sömn som mål, läkare, tandläkare, medicinska uppföljningar.
   - thoughts: Allmänna personliga tankar när inget mer specifikt område passar.
   - hobbies: Kreativ fritid och roliga sidoprojekt (inte för inkomst).
   - goals: Personliga mål och milstolpar utanför jobbet.
   - learning: Böcker, kurser, språk, färdigheter för personlig utveckling (jobbutbildning → work).
   - finance: Privatekonomi, budget, sparande, räkningar, prenumerationer.
   - home: Hushåll, boende, sysslor, reparationer (inköp → shopping).
   - travel: Resor, semester, transportplaner.
   - shopping: Saker att köpa (mat, kläder, hemma).
7. Work: Använd category "projects" eller "tasks" och sätt project_name när ett arbetsprojekt nämns. Work item_types: task, note, idea, calendar, shopping (endast vid tydliga jobbinköp).
   Om användaren nämner ett projekt som inte finns i listan "Befintliga projekt", sätt ändå project_name till det namnet — appen skapar projektet. Utelämna aldrig project_name bara för att projektet är nytt.
   När "Befintliga projekt" listas nedan MÅSTE du matcha användarens tal till ett av namnen om det är samma verkliga projekt (se regel 10). Skapa inte en ny stavning som bara skiljer lite.
8. recommended_view: task_list eller kanban för tasks; note_cards för notes, idéer och shopping; reflection_cards för reflections.
9. confidence_score: 0–1. title: kort rubrik. content: full beskrivning; krävs för varje post.
10. Befintliga arbetsprojekt (när de listas nedan): Listan är sanningen för projektnamn.
   - Innan du sätter project_name på en work-post: avgör om användaren menar ett av dessa projekt trots stavfel, saknat mellanslag, extra uttalat "och" mitt i namnet (t.ex. "Relax och experience" = listat "Relaxperience"), förkortning eller versaler/gemener.
   - Om det är samma projekt: använd EXAKT strängen från listan tecken för tecken.
   - Skapa aldrig nästan-dubbletter (t.ex. om listan har "Relaxperience": använd INTE "Relaxandexperience", "Relax Experience" eller "Relaxandexperiance").
   - Vid tvekan mellan två listade: välj närmaste listnamn; hitta inte på en tredje stavning.
11. Bara "skapa projekt": Om användaren främst vill registrera ett tomt arbetsprojekt (t.ex. "Skapa ett projekt som heter X", "Nytt projekt Y", "Lägg till projekt Z") utan att samtidigt beskriva konkreta uppgifter, anteckningar eller idéer:
   - Lägg ENDAST nya namn i "standalone_project_creations".
   - Sätt "items" till []. Skapa INTE note, idea eller task som bara upprepar skapa-projekt-meningen eller ekar projektnamnet utan annat innehåll.
   Om samma uttalande OCKSÅ innehåller riktiga uppgifter eller idéer, lägg dem i "items" som vanligt och lägg ändå in standalone_project_creations för helt nya projekt utan poster.

Fältnamn domain, category, item_type osv ska vara på engelska som i schemat nedan. Värden i title och content ska vara på svenska när användaren pratat svenska.

Kategorier är dynamiska. Föredra befintliga när de passar; du FÅR skapa nya category-namn (lowercase, snake_case) när innehållet tydligt passar någon annanstans.
När befintliga kategorier listas nedan, föredra dem.

Svara med ett enda JSON-objekt:
{ "items": [ ... ], "standalone_project_creations"?: string[] }
Varje element i "items": { "domain", "category", "subcategory", "project_name?", "item_type", "title", "content", "tags?", "emotion_label?", "recommended_view", "confidence_score", "task_due_date?", "shopping_due_date?", "scheduled_date?", "scheduled_time?", "recurrence?", "send_notification?", "reminder_minutes_before?" }
För shopping med planerad dag: shopping_due_date (YYYY-MM-DD). För calendar-poster: scheduled_date och scheduled_time när användaren gett datum eller tid.
standalone_project_creations: strängarray enligt regel 11; utelämna eller []. Använd bara listade fält. Ingen extra kommentar.`;

export interface OrganizeTranscriptResult {
  items: OrganizedItemInput[];
  /** Work project names to create as empty projects (no note); client creates via API. */
  standaloneProjectCreations: string[];
}

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

const DEFAULT_CATEGORIES_WORK = ["projects", "tasks", "notes", "ideas", "meetings", "opportunities"];
const DEFAULT_CATEGORIES_INBOX = ["unprocessed", "needs_review"];

function mergeCategoryHintList(defaults: string[], existing?: string[], custom?: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...defaults, ...(existing ?? []), ...(custom ?? [])]) {
    const s = raw.trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out.join(", ");
}

function buildSystemPrompt(options: OrganizeOptions): string {
  const sv = options.locale === "sv";
  const base = sv ? ORGANIZE_SYSTEM_PROMPT_SV : ORGANIZE_SYSTEM_PROMPT;
  let extra = "";
  if (options.projectNames?.length) {
    extra += sv
      ? `\n\nBefintliga arbetsprojekt i appen (obligatoriskt att följa regel 10 ovan — kopiera exakt från listan när användaren menar samma projekt):\n${options.projectNames.map((n) => `- ${n}`).join("\n")}`
      : `\n\nExisting work projects in the app (you MUST follow rule 10 above — copy exactly from this list when the user means the same project):\n${options.projectNames.map((n) => `- ${n}`).join("\n")}`;
  }
  if (options.defaultDomain) {
    extra += sv
      ? `\n\nStandardkontext för denna session: "${options.defaultDomain}". Vid tvekan om klassificering, föredra denna domain.`
      : `\n\nDefault context for this session: "${options.defaultDomain}". When classification is ambiguous, prefer this domain.`;
  }

  const merged =
    options.defaultDomain === "work"
      ? mergeCategoryHintList(DEFAULT_CATEGORIES_WORK, options.existingCategories, options.customCategories)
      : options.defaultDomain === "personal"
        ? mergeCategoryHintList([...PERSONAL_AREA_DEFAULTS], options.existingCategories, options.customCategories)
        : mergeCategoryHintList(DEFAULT_CATEGORIES_INBOX, options.existingCategories, options.customCategories);

  extra += sv
    ? `\n\nKategorier/områden att välja mellan (standard + från databas + användartillagda — föredra mest specifika som passar innehållet): ${merged}.`
    : `\n\nCategories/areas to choose from (defaults + from database + user-added — prefer the most specific that fits the content): ${merged}.`;
  return base + extra;
}

function parseStandaloneFromResponse(parsed: Record<string, unknown>): string[] {
  const raw = parsed.standalone_project_creations ?? parsed.standaloneProjectCreations ?? [];
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const s = x.trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

export async function organizeTranscript(
  transcript: string,
  openaiApiKey: string,
  options: OrganizeOptions = {}
): Promise<OrganizeTranscriptResult> {
  if (!transcript?.trim()) return { items: [], standaloneProjectCreations: [] };

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
  if (!text) return { items: [], standaloneProjectCreations: [] };

  const WORK_ITEM_TYPES = new Set(["task", "task_completed", "shopping", "note", "idea", "calendar"]);
  const PERSONAL_ITEM_TYPES = new Set(["task", "task_completed", "shopping", "note", "idea", "emotion", "reflection", "calendar"]);

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
    if (domain === "personal" && (category === "health" || category === "fitness")) return "health_fitness";
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
    const parsedRecord = parsed as unknown as Record<string, unknown>;
    const rawStandalone = parseStandaloneFromResponse(parsedRecord);
    const fromTranscript = extractExplicitWorkProjectNames(transcript);
    const mergedStandaloneRaw: string[] = [];
    const seenStandalone = new Set<string>();
    for (const s of [...rawStandalone, ...fromTranscript]) {
      const t = s.trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (seenStandalone.has(k)) continue;
      seenStandalone.add(k);
      mergedStandaloneRaw.push(t);
    }
    const standaloneProjectCreations = filterNewStandaloneProjectNames(mergedStandaloneRaw, options.projectNames ?? []);
    const namesForEchoFilter = mergedStandaloneRaw;
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const mappedItems = items.map((item) => {
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
      const canonicalWorkProject =
        domain === "work" && mergedProjectName
          ? resolveProjectNameToCanonical(mergedProjectName, options.projectNames ?? [])
          : mergedProjectName;
      // Guardrail: ambiguous non-project tasks should default to personal unless clearly work.
      if (
        domain === "work" &&
        (item_type === "task" || item_type === "task_completed") &&
        !hasProjectName &&
        options.defaultDomain !== "work" &&
        !shouldTreatAsWorkTask(item)
      ) {
        domain = "personal";
      }
      const category = normalizeCategory(domain, item.category ?? "");
      const normalizedCategory =
        domain === "personal" && (item_type === "task" || item_type === "task_completed") && (!category || category === "projects")
          ? "tasks"
          : domain === "personal" && item_type === "shopping" && (!category || category === "tasks" || category === "projects")
            ? "shopping"
            : category;

      let scheduled_date = pickStr(raw, "scheduled_date", "scheduledDate");
      const task_due_raw = pickStr(raw, "task_due_date", "taskDueDate");
      const shopping_due_raw = pickStr(raw, "shopping_due_date", "shoppingDueDate");
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
        project_name: domain === "work" ? canonicalWorkProject || undefined : mergedProjectName || undefined,
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

      if (item_type === "task" || item_type === "task_completed") {
        const due =
          (task_due_raw && /^\d{4}-\d{2}-\d{2}$/.test(task_due_raw) ? task_due_raw : undefined) ||
          (scheduled_date && /^\d{4}-\d{2}-\d{2}$/.test(scheduled_date) ? scheduled_date : undefined);
        if (due) {
          base.scheduled_date = due;
        }
      }

      if (item_type === "shopping") {
        const due =
          (shopping_due_raw && /^\d{4}-\d{2}-\d{2}$/.test(shopping_due_raw) ? shopping_due_raw : undefined) ||
          (scheduled_date && /^\d{4}-\d{2}-\d{2}$/.test(scheduled_date) ? scheduled_date : undefined) ||
          (task_due_raw && /^\d{4}-\d{2}-\d{2}$/.test(task_due_raw) ? task_due_raw : undefined);
        if (due) {
          base.scheduled_date = due;
        }
      }

      return base;
    });
    const filteredItems = filterRedundantProjectCreationNotes(mappedItems, transcript, namesForEchoFilter);
    return { items: filteredItems, standaloneProjectCreations };
  } catch {
    return { items: [], standaloneProjectCreations: [] };
  }
}
