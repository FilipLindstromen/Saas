/**
 * Organization engine: takes a transcript and returns structured items via AI.
 * Keeps business logic separate from UI and API.
 * Long transcripts are split and merged server-side (see organizeTranscriptResilient).
 */

import { normalizeReminderMinutesBefore } from "./calendar-schedule";
import { splitTranscriptIntoChunks } from "./transcript-chunks";
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
1. Headlines (title) and descriptions (content) MUST match the item kind:
   a) Reflections, feelings, emotional processing, journal-style content about mood, body, relationships, worries, or "what I'm thinking" (item_type reflection with category feeling, emotion_label use, or clearly therapeutic journaling): title = short, humane headline. content = stay faithful to the user's wording — verbatim or close paraphrase; preserve tone and nuance. Do NOT compress into terse commands or strip "I feel…" style language.
   b) Actionable and informational items (task, shopping, calendar, plus notes and ideas that are NOT primarily emotional): remove meta / assistant-command filler. Do NOT paste the user's full instruction sentence into content (e.g. avoid reproducing "I want to … so create a calendar event…").
      Strip framing such as: "I want to", "I need to", "I have to" (express the action directly in title/content instead), "create a calendar event", "add a calendar", "add a task", "add a reminder", "schedule", "remind me to", "can you", "please", "don't forget", "make sure to", filler like "so " / "okay " that only introduce the request.
      • title = concrete action or event name (e.g. "Exercise", "Buy milk and eggs", "Change graphics").
      • content = one or two short lines: distilled what/when/where/project — not a repeat of meta-instructions. Use structured date/time fields for calendar items; do not bury the only time mention exclusively inside a long rambling sentence.
      • Calendar: title = event name; content = brief natural line (e.g. "Exercise at 2:00 pm."); scheduled_date + scheduled_time carry the schedule.
      • Reference examples (use reference date/time below for "today"/"tomorrow"):
        – "I want to exercise tomorrow, so create a calendar event at 2 pm." → item_type calendar, title "Exercise", content "Exercise at 2:00 pm.", scheduled_date = tomorrow, scheduled_time = 14:00
        – "Tomorrow I need to buy milk and egg" → item_type shopping, title "Buy milk and eggs", short content (e.g. "Milk and eggs."), shopping_due_date = tomorrow
        – "Tomorrow I need to change graphics in project X" → item_type task, project_name from X, title "Change graphics", short content; task_due_date = tomorrow (take "tomorrow", "today", "next Monday" literally from the reference date).
        – "I need to take out the trash" / "need to go out with the trash" / "gotta empty the bins" → item_type **task** (home chore), domain personal, category **home**, title e.g. "Take out trash", short content — **not** note, not shopping (no goods to buy).
        – "I have a meeting at 2pm about gardening" (no day given) → item_type **calendar**, title **"Gardening"** (the topic), content brief line e.g. "Meeting about gardening.", **scheduled_date** = **reference today**, **scheduled_time** = 14:00.
   Never leave content empty — at least one concise, concrete sentence (or faithful reflection text for 1a).
2. Merge related content into ONE entry. Do not split one continuous thought, feeling, or utterance into multiple items. Example: "I feel discomfort in my body, pain, tightness and I don't like it" → one reflection item per rule 1a with title "Discomfort in the body" and content that preserves their words. Only create multiple items when the user clearly switches to a different topic, task, or idea.
3. Split the transcript into multiple items only when it contains distinct topics, tasks, feelings, or ideas. One sentence that expresses one thing = one item.
4. domain is critical — separate personal from work:
   - personal: Hobby projects, creative pursuits the user does for themselves ("personal thing", "not work-related"), how they feel (tired, body feelings, emotional state), reflections about life or wellbeing, personal goals, health, relationships, shopping. If the user says something is a "personal" thing or a "hobby project", it is always personal.
   - work: Work projects, work tasks, professional courses, business/marketing tasks, deliverables for a job or business. If a project name is clearly work (e.g. LumiRush as a product/tool), tasks for that project are work. "Set up a sales page" or "create one video each day for marketing" are work when tied to a work project.
   - If a task does not mention a specific work project and has no clear work context, classify it as personal (e.g. home errands like changing windshield wipers).
   - **Calendar** entries: When the user gives a clock time but no calendar day (e.g. "at 2pm", "kl 14", "this afternoon at three") for something that belongs on the calendar, set **scheduled_date** to the **reference date below as "today"** and **scheduled_time** to the time they said. Do not leave scheduled_date empty for calendar items just because they omitted the word "today".
   - **Tasks (item_type task or task_completed) — due dates:** Set **task_due_date** and task **scheduled_time** **only** when the user **clearly ties the task to a specific day or deadline**. Examples that **qualify**: "today", "tonight", "tomorrow", "this morning/afternoon/evening" (as today's dayparts), "next Monday", "by Friday", "end of the week", "should be done tomorrow", "need to do it today", "must finish by …", "deadline …", "complete it by Thursday". Examples that **do not qualify** (omit **task_due_date** and omit task **scheduled_time**): bare "I need to …", "I should …", "I have to …", "remember to …" with **no** day, date, week anchor, or explicit "by / before / due / finish by" wording. **Never** infer "today" on a task from a clock time alone without a day anchor — if they gave only a time slot for a concrete block, use **calendar** instead. **Never** set **task_due_date** to the reference "today" date unless the user **explicitly** said a day anchor that means today (e.g. today, tonight, this morning) or another explicit date — do **not** add today's date to undated tasks "by default".
   - Picking up, dropping off, or meeting a **person** (e.g. "pick up Mio", "get the kids", "meet Anna at five") is **not** shopping. Prefer **item_type calendar** when there is a **fixed clock time** or an implied "today" time block (scheduled_date + scheduled_time). Use **task** **without** task_due_date for vague reminders ("don't forget to text Anna") with no day or time. **domain = personal**, no project_name, unless the user clearly ties it to work. Category **relationships** (family/partner/kids/friends) or **tasks** (other social). Example: "I need to pick up Mio at 2pm" with no work project → personal, **calendar**, title e.g. "Pick up Mio", **scheduled_date** = user's local **today** from the reference below, **scheduled_time** = 14:00.
   - **Timed personal people & logistics (disambiguation):** Verbs like pick up / drop off / collect / meet / school run / drive someone (Swedish: hämta, lämna, träffa, skjutsa, köra … hem) with a **person or kids** as the object are **never shopping** — even if they say "pick up". **Shopping** is for **goods**: groceries, milk, store orders, retail packages, dry cleaning as items. **Work-session override:** If the default context is **work** but the line has **no work project**, **no work keywords**, and matches this people-logistics pattern, still output **domain personal**.
5. item_type is critical:
   - Use "task" for concrete to-dos: the user does **not** need to say "task" or "todo". Treat as **task** whenever they express **something that must or should get done** — obligation language ("I need to", "I have to", "I've got to", "we need to", "should really", "must", "gotta") plus a **concrete action** — including **home chores** (take out / go out with the trash, do dishes, vacuum), **errands** without only a clock-bound meeting block (return package, renew licence, call to book), **admin** (pay invoice, file form), plus explicit "task/todo" wording and **product/backlog** phrasing: "Add a feature …", "implement X", "ship …", "fix …", "refactor …" → **task**, not "idea" or "note", unless clearly pure speculation ("maybe someday we could …"). **If it is doable work but not shopping, not a timed meeting/call/appointment (→ calendar), and not emotional reflection → task.** Examples: "I need to go out with the trash"; "still need to pick up the dry cleaning" (no time → task; "at 5" for a pickup errand → often **calendar** if it's a fixed slot). **After rule 1b you may strip "I need to" from title/content, but item_type stays task when the utterance was an obligation or actionable item.** **Task deadlines:** only **task_due_date** / task **scheduled_time** when explicit due timing (rule 4) — e.g. "Tomorrow I need to change graphics in project X" → task + task_due_date; "I need to change the graphics" → task, no dates.
   - Use "idea" only for open exploration or possibilities **without** stated obligation: "what if we …", "could be interesting to explore …". Do **not** use "idea" when the user states something they or the team **need to / should / must** do, or **add / implement / fix / ship**-style backlog language — those are **tasks** (deadline optional).
   - Use "reflection" for how the user feels, body state, tiredness, emotional state, or brief reflections not tied to a project — always use category "feeling" and domain "personal" for these. Do NOT attach these to projects or hobbies.
   - Use "note" for general notes, facts, decisions, updates. When in doubt, use "note".
   - Use "shopping" for things to buy or get from a store: groceries, clothes, household items, phrases like "I need to shop", "buy socks", "pick up milk", "get from the store". Prefer "shopping" over "task" when the action is purchasing goods (e.g. "I need to shop socks tomorrow" → item_type "shopping", not "task"). **Do not** use shopping for "pick up [person's name]" or childcare/school run — those are calendar or task (see domain rule above). Use domain "personal" and category "shopping" unless it is clearly work-related procurement (office supplies for work → domain "work", category "shopping"). When the user says when to shop (e.g. "tomorrow", "today", "next Saturday"), you MUST set shopping_due_date (YYYY-MM-DD) using the reference date/time below — the app stores this as the shopping list due day. Omit only if no day was implied at all.
   - Use "calendar" for time-bound or recurring items (e.g. "every day", "every Monday", "remind me next week", events with a date/time). These appear only in the Calendar view.
   - **Meetings, calls, appointments, interviews, demos, syncs, standups** ("meeting", "call with", "zoom", "dentist appointment", Swedish: "möte", "bokat", "samtal") — when the user gives a **clock time** or clear session slot, use **calendar**, not task. **Title** = short name of what it's about: prefer the **topic** after "about", "regarding", "re:", or the stated subject (e.g. "I have a meeting at 2pm about gardening" → title **"Gardening"**; "call at three about the budget" → title **"Budget"** or **"Budget call"**). Set **scheduled_date** to the **reference "today"** if they did not name a day; set **scheduled_time** from "2pm", "14:00", "three", etc. Content = one short line (e.g. "Meeting about gardening at 14:00.").
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
9. confidence_score: 0–1. title: short headline (rule 1: cleaned for actions/events; empathetic for feelings). content: required — rule 1a faithful for reflections; rule 1b concise distilled lines for everything else.
10. Existing work projects (when listed below): This list is the source of truth for work project names.
   - Before setting project_name on ANY work item, decide if the user meant one of these projects. Match despite: typos, missing spaces, extra spoken words like "and" in the middle of a name (e.g. speech "Relax and experience" → same as listed "Relaxperience"), abbreviations, or different capitalization.
   - When it is the same project, set project_name to the EXACT string from the list, character-for-character.
   - Never output a near-duplicate name (e.g. if the list has "Relaxperience", do NOT use "Relaxandexperience", "Relax Experience", or "Relaxandexperiance").
   - If unsure between two listed projects, pick the closest list match; do not invent a third spelling.
11. Explicit "create project" only: If the user mainly wants to register an empty work project (e.g. "Create a project called X", "Create a project caled X", "New project named Y", "Add a work project Z", "Skapa ett projekt som heter X") and is NOT also describing substantive tasks, notes, or ideas to store, then:
   - Put ONLY the new project name(s) in "standalone_project_creations" (array of strings).
   - Set "items" to [] (empty array). Do NOT create a note, idea, or task that only repeats the project-creation request or echoes the project name without other work content.
   If the same utterance ALSO contains real tasks, meeting notes, or ideas unrelated to the shell project, put those in "items" as usual AND still add standalone_project_creations for any brand-new project shell(s) that have no items yet.
12. Numerals: In **title** and **content**, prefer **Arabic digits** for quantities, counts, and amounts the user states as numbers (e.g. 7, 14, 3 items, €50) rather than spelling them out in words (seven, fourteen, three items, fifty euros). Keep words only when the user clearly used fixed phrases or titles that are conventionally written out, or for small grammar words (e.g. "first", "once").

Categories and sections are dynamic. Prefer existing ones when they fit; you MAY create new category names (lowercase, snake_case) when content clearly belongs elsewhere.
When existing_categories are provided below, prefer those.

Respond with a single JSON object:
{ "items": [ ... ], "standalone_project_creations"?: string[] }
Each "items" element: { "domain", "category", "subcategory", "project_name?", "item_type", "title", "content", "tags?", "emotion_label?", "recommended_view", "confidence_score", "task_due_date?", "shopping_due_date?", "scheduled_date?", "scheduled_time?", "recurrence?", "send_notification?", "reminder_minutes_before?" }
For **tasks**: put due dates **only** in **task_due_date** (YYYY-MM-DD) and optional task **scheduled_time** (HH:mm), and **only** when the user explicitly stated a due day or deadline (rule 4); otherwise omit both and do **not** put the due date in **scheduled_date** for tasks. Never default undated tasks to today's date. For **shopping** with a planned day, include shopping_due_date (YYYY-MM-DD). For **calendar** items, include scheduled_date and related fields as in the rules above.
standalone_project_creations: array of strings (work project names to create as empty projects), per rule 11. Omit the key or use [] if none.
Use only the fields listed. No extra commentary.`;

const ORGANIZE_SYSTEM_PROMPT_SV = `Du är en assistent för att organisera tankar. Din uppgift är att analysera ett rått transkript (en "brain dump") och dela upp det i strukturerade poster.

Regler:
1. Rubrik (title) och beskrivning (content) ska spegla postens typ:
   a) Reflektioner, känslor, kropp, mående, bekymmer, terapiliknande journal om "hur jag mår/tänker" (item_type reflection, category feeling, emotion_label, eller tydligt känslomässigt innehåll): title = kort, empatisk rubrik. content = troget mot användaren — ordagrant eller nära omformulering; behåll ton och nyans. Komprimera INTE till torra order eller ta bort "jag känner…"-språk i onödan.
   b) Handlingsposter och fakta (task, shopping, calendar, samt anteckningar/idéer som INTE främst är känslomässiga): ta bort utfyllnadsfraser och "skapa en kalenderhändelse"-meta. Kopiera INTE hela instruktionsmeningen in i content (t.ex. inte "jag vill … så skapa ett kalenderevent …").
      Ta bort inramning som: "jag vill", "jag måste", "jag behöver", "jag ska" (uttryck handlingen direkt i title/content), "skapa kalender", "lägg till uppgift", "påminn mig att", "kan du", "snälla", "glöm inte", "se till att", utfyllnad som "så ", "okej " som bara leder in önskemålet.
      • title = konkret handling eller händelsenamn (t.ex. "Träning", "Köpa mjölk och ägg", "Byt grafik").
      • content = en eller två korta rader: vad/när/var/projekt — destillerat, inte upprepning av meta-instruktioner. För kalender: datum/tid i fält (scheduled_date, scheduled_time).
      • Exempel (med referensdatum nedan för "idag"/"imorgon"):
        – "Jag vill träna imorgon, skapa kalenderhändelse klockan 14." → calendar, title "Träning", content "Träning kl. 14:00.", scheduled_date = imorgon, scheduled_time = 14:00
        – "Imorgon måste jag köpa mjölk och ägg" → shopping, title "Köpa mjölk och ägg", kort content, shopping_due_date = imorgon
        – "Imorgon behöver jag byta grafik i projekt X" → task, project_name från X, title "Byta grafik", kort content, task_due_date = imorgon
        – "Jag måste slänga soporna" / "behöver gå ut med soporna" → **task** (hemsyssla), domain personal, category **home**, title t.ex. "Slänga soporna" — **inte** anteckning, **inte** shopping (inga varor att köpa).
        – "Jag har möte klockan 14 om trädgårdsskötsel" (ingen dag nämnd) → **calendar**, title **"Trädgårdsskötsel"** (ämnet), kort content, **scheduled_date** = **referens idag**, **scheduled_time** = 14:00.
   Lämna aldrig content tom — minst en kort, konkret mening (eller trogen reflekterande text för 1a).
2. Slå ihop närhörande innehåll till EN post. Dela inte en sammanhängande tanke, känsla eller yttrande i flera poster. Exempel: "Jag känner obehag i kroppen, smärta, stramhet och jag gillar det inte" → en reflectionspost enligt 1a med bevarad formulering. Skapa flera poster bara när användaren tydligt byter ämne, uppgift eller idé.
3. Dela transkriptet i flera poster bara när det innehåller skilda ämnen, uppgifter, känslor eller idéer. En mening som uttrycker en sak = en post.
4. domain är avgörande — skilj privat från arbete:
   - personal: Hobbyprojekt, kreativa sysslor för sig själv ("privat", "inte jobbrelaterat"), hur man mår (trött, kropp, känsla), reflektioner om liv eller välmående, personliga mål, hälsa, relationer, shopping. Om användaren säger att något är "privat" eller hobby, ska det alltid vara personal.
   - work: Arbetsprojekt, arbetsuppgifter, yrkeskurser, affärs-/marknadsföringsuppgifter, leveranser för jobb eller företag. Om ett projektnamn tydligt är arbete, är uppgifter för det projektet work. "Sätt upp en säljlanding" eller "gör en video om dagen för marknadsföring" är work när det kopplas till ett arbetsprojekt.
   - Om en uppgift inte nämner ett specifikt arbetsprojekt och saknar tydlig arbetskontext, klassificera den som personal (t.ex. hemmaärenden som att byta vindrutetorkare).
   - **Kalenderposter:** Om användaren anger klockslag men ingen kalenderdag (t.ex. "klockan 14", "kl två", "eftermiddag tre") för något som hör hemma i kalendern: sätt **scheduled_date** till **referensdatum nedan som "idag"** och **scheduled_time** till tiden. Lämna inte scheduled_date tomt bara för att de inte sa ordet "idag".
   - **Uppgifter (item_type task / task_completed) — deadline:** Sätt **task_due_date** och ev. task **scheduled_time** **bara** om användaren **tydligt kopplar uppgiften till en viss dag eller deadline**. **Godkänt:** "idag", "imorgon", "i kväll", "i morse/i eftermiddag" (som dagsdelar idag), "nästa måndag", "senast fredag", "ska vara klar imorgon", "måste göra det idag", "deadline …", "innan torsdag". **Inte godkänt** (utelämna task_due_date och task scheduled_time): bara "jag måste …", "jag behöver …", "jag ska …", "kom ihåg att …" **utan** dag, datum, veckoanknytning eller tydligt "senast / innan / klar till". **Gissa aldrig "idag"** på en uppgift enbart från klockslag — vid fast tidsblock, använd **calendar** i stället. Sätt **aldrig** **task_due_date** till referensdatum "idag" om användaren **inte** uttryckligen sagt något som betyder idag (idag, i kväll, i morse, osv.) eller annat tydligt datum — **inte** som standard för odaterade uppgifter.
   - Hämta/lämna eller träffa en **person** (t.ex. "hämta Mio", "hämta barnen") är **inte** shopping. Föredra **calendar** vid **konkret klockslag** eller underförstått "idag"-block (**scheduled_date** + **scheduled_time**). **Task** **utan** task_due_date för vaga påminnelser ("kom ihåg att sms:a Anna") utan dag eller tid. **domain = personal**, inget project_name om det inte tydligt är jobb. Category **relationships** eller **tasks**. Exempel: "Jag måste hämta Mio klockan två" utan arbetsprojekt → personal, **calendar**, title t.ex. "Hämta Mio", **scheduled_date** = användarens **idag** enligt referensen, **scheduled_time** = 14:00.
   - **Privat logistik med människor:** Hämta/lämna/träffa/skjutsa/köra (person eller barn) är **aldrig shopping** — även om de säger "hämta". **Shopping** gäller **varor**: mat, butik, paket från återförsäljare, kemtvätt som **sak**. **Åsidosätt work-kontext:** Om standardläget är **work** men meningen saknar **arbetsprojekt**, saknar **arbetsnyckelord** och matchar detta mönster → **domain personal** i alla fall.
5. item_type är avgörande:
   - Använd "task" för konkreta göromål: användaren behöver **inte** säga "uppgift" eller "todo". **Task** när något **ska eller måste göras** — "jag måste", "jag behöver", "jag ska", "vi behöver", "borde verkligen", "måste", måste + **handling**: **hemsysslor** (slänga soporna, diska, dammsuga), **ärenden** utan rent mötesblock (lämna tillbaka paket, förnya legitimation), **admin** (betala räkning), plus uttrycklig uppgift/backlog: "lägg till funktion", "implementera", "fixa", "ship:a" — **task**, inte "idea"/"note", om det inte bara är spekulation. **Är det görbart, inte inköp, inte tidsbunden möte/samtal (→ calendar), inte känsloreflektion → task.** Exempel: "jag måste gå ut med soporna". **Efter regel 1b** kan du städa bort "jag behöver" i rubrik men **item_type task** om det var en skyldighet. **Deadline** bara vid uttrycklig tid (regel 4).
   - Använd "idea" bara för öppen exploration utan uttalad skyldighet. Använd **inte** "idea" när användaren säger att något **måste / bör / behöver** göras eller använder **lägg till / implementera / fixa / ship**-språk — då är det **task** (deadline valfri).
   - Använd "reflection" för hur användaren mår, kroppstillstånd, trötthet, känsloläge, eller korta reflektioner utan projekt — använd alltid category "feeling" och domain "personal". Koppla INTE dessa till projekt eller hobbies.
   - Använd "note" för allmänna anteckningar, fakta, beslut, uppdateringar. Vid tvekan, använd "note".
   - Använd "shopping" för saker att köpa: mat, kläder, "jag måste handla", "köpa strumpor", "handla imorgon". Föredra "shopping" framför "task" när det handlar om att köpa varor (t.ex. "handla strumpor imorgon" → shopping). **Inte** shopping för "hämta [personnamn]" eller barnlämning — då calendar eller task (se regel ovan). Använd domain "personal" och category "shopping" om det inte tydligt är inköp för jobbet. När användaren säger när handla (t.ex. "imorgon", "idag"), MÅSTE du sätta shopping_due_date (YYYY-MM-DD) med referensdatum nedan — appen använder det som datum för inköpsraden. Utelämna bara om ingen dag alls antyds.
   - Använd "calendar" för tidsbundna eller återkommande saker (t.ex. "varje dag", "varje måndag", "påminn mig nästa vecka", händelser med datum/tid).
   - **Möten, samtal, bokade tider, intervjuer, demo, sync, standup** — när användaren ger **klockslag** eller tydlig tidslucka: **calendar**, inte task. **Title** = kort ämnesnamn: efter "om", "angående", "handlar om" (t.ex. "möte klockan 14 om trädgården" → title **"Trädgård"** eller **"Trädgårdsskötsel"**). **scheduled_date** = **referens "idag"** om ingen dag nämns; **scheduled_time** från talat klockslag. Kort **content** (e.g. "Möte om trädgården kl. 14:00.").
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
9. confidence_score: 0–1. title: kort rubrik (regel 1: städad för handlingar/händelser; empatisk för känslor). content: krävs — regel 1a troget för reflektioner; regel 1b korta destillerade rader för övrigt.
10. Befintliga arbetsprojekt (när de listas nedan): Listan är sanningen för projektnamn.
   - Innan du sätter project_name på en work-post: avgör om användaren menar ett av dessa projekt trots stavfel, saknat mellanslag, extra uttalat "och" mitt i namnet (t.ex. "Relax och experience" = listat "Relaxperience"), förkortning eller versaler/gemener.
   - Om det är samma projekt: använd EXAKT strängen från listan tecken för tecken.
   - Skapa aldrig nästan-dubbletter (t.ex. om listan har "Relaxperience": använd INTE "Relaxandexperience", "Relax Experience" eller "Relaxandexperiance").
   - Vid tvekan mellan två listade: välj närmaste listnamn; hitta inte på en tredje stavning.
11. Bara "skapa projekt": Om användaren främst vill registrera ett tomt arbetsprojekt (t.ex. "Skapa ett projekt som heter X", "Nytt projekt Y", "Lägg till projekt Z") utan att samtidigt beskriva konkreta uppgifter, anteckningar eller idéer:
   - Lägg ENDAST nya namn i "standalone_project_creations".
   - Sätt "items" till []. Skapa INTE note, idea eller task som bara upprepar skapa-projekt-meningen eller ekar projektnamnet utan annat innehåll.
   Om samma uttalande OCKSÅ innehåller riktiga uppgifter eller idéer, lägg dem i "items" som vanligt och lägg ändå in standalone_project_creations för helt nya projekt utan poster.
12. Siffror: I **title** och **content**, föredra **siffror** (7, 14, 3 st, 50 kr) framför utskrivna tal (sju, fjorton, tre stycken, femtio kronor) när användaren uttrycker mängder eller antal som tal. Behåll ord bara i fasta uttryck, titlar eller grammatik (t.ex. "första", "en gång").

Fältnamn domain, category, item_type osv ska vara på engelska som i schemat nedan. Värden i title och content ska vara på svenska när användaren pratat svenska.

Kategorier är dynamiska. Föredra befintliga när de passar; du FÅR skapa nya category-namn (lowercase, snake_case) när innehållet tydligt passar någon annanstans.
När befintliga kategorier listas nedan, föredra dem.

Svara med ett enda JSON-objekt:
{ "items": [ ... ], "standalone_project_creations"?: string[] }
Varje element i "items": { "domain", "category", "subcategory", "project_name?", "item_type", "title", "content", "tags?", "emotion_label?", "recommended_view", "confidence_score", "task_due_date?", "shopping_due_date?", "scheduled_date?", "scheduled_time?", "recurrence?", "send_notification?", "reminder_minutes_before?" }
För **task**: lägg deadline **bara** i **task_due_date** (YYYY-MM-DD) och ev. task **scheduled_time** (HH:mm), och **bara** när användaren uttryckligen sagt förfallodag eller deadline (regel 4); annars utelämna båda och sätt **inte** datumet i **scheduled_date** för uppgifter. Standardlägg inte "idag" på odaterade uppgifter. För **shopping** med planerad dag: shopping_due_date (YYYY-MM-DD). För **calendar**: scheduled_date och scheduled_time enligt reglerna ovan.
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
  /** User's local calendar date YYYY-MM-DD (avoids UTC midnight shifting "today" for reminders). */
  referenceLocalDate?: string;
  /** When organizing a transcript in multiple API passes (long text). */
  chunkPart?: { index: number; total: number };
}

const TRANSCRIPT_MAX_CHARS = 400_000;
const CHUNK_TRIGGER_LENGTH = 7_000;
const CHUNK_TARGET_CHARS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, attempts: number, label: string): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts - 1) await sleep(450 * (i + 1));
    }
  }
  const msg = last instanceof Error ? last.message : String(last);
  throw new Error(`${label} failed after ${attempts} attempts: ${msg}`);
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

function getReferenceLocalDateForGuardrails(options: OrganizeOptions): string | undefined {
  const loc = options.referenceLocalDate?.trim();
  if (loc && /^\d{4}-\d{2}-\d{2}$/.test(loc)) return loc;
  const iso = options.referenceIso?.trim();
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Heuristic: picking up / meeting people vs groceries or store pickups (EN/SV). */
function textSuggestsPersonLogisticsNotGroceries(text: string): boolean {
  const s = text.replace(/\s+/g, " ").trim();
  if (!s) return false;
  const low = s.toLowerCase();

  if (/\b(pick\s*up|pickup)\s+(my\s+)?(groceries|milk|eggs|bread|wine|beer|flowers|cake)\b/i.test(s)) return false;
  if (/\b(pick\s*up|pickup)\s+the\s+(groceries|milk|stuff\s+from|order\s+from)\b/i.test(low)) return false;
  if (/\b(pick\s*up|pickup)\s+(a\s+)?package\s+(from|at)\b/i.test(low)) return false;
  if (/\bhämta\s+(mat|mjölk|paket|beställning|grejerna|varorna)\b/.test(low)) return false;

  if (/\b(pick\s*up|pickup|drop\s*-?off|drop\s+off)\s+my\s+(son|daughter|kid|kids|child|children)\b/i.test(low))
    return true;
  if (/\b(pick\s*up|pickup|drop\s*-?off|drop\s+off)\s+([A-ZÅÄÖ][a-zåäö]{1,}|[A-ZÅÄÖ]{2,})\b/.test(s)) return true;
  if (/\b(get|collect)\s+(the\s+)?(kids|children|child)\b/i.test(low)) return true;
  if (/\bmeet\s+([A-ZÅÄÖ][a-zåäö]+)\b/.test(s)) return true;
  if (/\bhämta\s+([A-ZÅÄÖ][a-zåäö]{1,}|barnen|kidsen|ungarna)\b/.test(s)) return true;
  if (/\blämna(\s+av)?\s+([A-ZÅÄÖ][a-zåäö]{1,}|barnen)\b/i.test(s)) return true;
  if (/\b(skjutsa|kör)\s+([A-ZÅÄÖ][a-zåäö]{1,}|barnen)\b/i.test(low)) return true;

  return false;
}

function blobLooksLikeWorkContext(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(work|job|office|client|deadline|meeting|boss|team|company|business|deploy|repo|ticket)\b/.test(t) ||
    /\b(arbete|jobb|kontor|kund|möte|deadline|chef|team|företag)\b/.test(t)
  );
}

function padHHmm(time: string): string {
  if (!/^\d{1,2}:\d{2}$/.test(time)) return time;
  const [h, m] = time.split(":");
  return `${h!.padStart(2, "0")}:${m!}`;
}

/** Strict calendar date: format + real calendar day (rejects 2025-02-31 etc.). */
function isValidYyyyMmDd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Normalize model clock output to HH:mm (accepts H:mm). */
function normalizeClockHHmm(raw: string | undefined): string | null {
  const t = String(raw ?? "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(":");
  return `${h!.padStart(2, "0")}:${m!}`;
}

/** Shopping→calendar fixes, work→personal for family logistics; infer "today" for calendar when only a clock time is set (not for tasks — deadlines require explicit user wording). */
function applyPersonalLogisticsGuardrails(item: OrganizedItemInput, options: OrganizeOptions): OrganizedItemInput {
  const refLocal = getReferenceLocalDateForGuardrails(options);
  let out: OrganizedItemInput = { ...item };

  const blob = `${out.title ?? ""} ${out.content ?? ""}`.trim();

  if (
    out.domain === "work" &&
    !(out.project_name && String(out.project_name).trim()) &&
    textSuggestsPersonLogisticsNotGroceries(blob) &&
    !blobLooksLikeWorkContext(blob)
  ) {
    out = {
      ...out,
      domain: "personal",
      project_name: undefined,
      category:
        out.category === "shopping" || !out.category || out.category === "tasks" || out.category === "projects"
          ? "relationships"
          : out.category,
    };
  }

  if (out.item_type === "shopping" && textSuggestsPersonLogisticsNotGroceries(blob)) {
    out = {
      ...out,
      item_type: "calendar",
      domain: "personal",
      project_name: undefined,
      category: "relationships",
      recommended_view:
        out.recommended_view === "reflection_cards" || out.recommended_view === "task_list"
          ? "note_cards"
          : (out.recommended_view ?? "note_cards"),
    };
  }

  const timeNorm = normalizeClockHHmm(out.scheduled_time);
  if (timeNorm) {
    out = { ...out, scheduled_time: timeNorm };
  }
  const hasValidTime = Boolean(timeNorm);
  const dateRaw = out.scheduled_date?.trim() ?? "";
  const hasValidDate = isValidYyyyMmDd(dateRaw);

  if (refLocal && out.item_type === "calendar") {
    if (hasValidTime && !hasValidDate) {
      out = { ...out, scheduled_date: refLocal };
    } else if (dateRaw && !hasValidDate) {
      out = { ...out, scheduled_date: refLocal };
    }
  }

  return out;
}

/** True when text is clearly a store run / procurement, not a general task. */
function textSuggestsShoppingNotTask(s: string): boolean {
  const low = s.replace(/\s+/g, " ").trim().toLowerCase();
  if (!low) return false;
  return (
    /\b(i need to|i have to|need to|got to)\s+(buy|shop|pick up)\s+(milk|groceries|eggs|bread|food|wine|beer)\b/.test(low) ||
    /\b(buy|shop for|pick up)\s+(milk|groceries|eggs)\b/.test(low) ||
    /\b(behöver|måste)\s+(köpa|handla)\b/.test(low) ||
    /\bhandla\s+(mat|mjölk)\b/.test(low)
  );
}

/**
 * Imperative / backlog phrasing should map to task (EN + SV).
 * Used when the model returns note or idea after stripping "I need to…" from the distilled fields.
 */
function textSuggestsObligationOrBacklogTask(s: string): boolean {
  const low = s.replace(/\s+/g, " ").trim().toLowerCase();
  if (!low) return false;
  if (textSuggestsShoppingNotTask(low)) return false;

  const en =
    /\bi need to\b/.test(low) ||
    /\bi have to\b/.test(low) ||
    /\bwe need to\b/.test(low) ||
    /\bi('[a-z]+)?ve got to\b/.test(low) ||
    /\bgotta\b/.test(low) ||
    (/\bi should\b/.test(low) && !/\bi should have\b/.test(low)) ||
    /\bneed to\s+(add|build|fix|implement|ship|finish|update|write|create|change|deploy|refactor|complete|deliver)\b/.test(low) ||
    /\b(add a feature|add feature|new feature|feature request)\b/.test(low) ||
    /\bimplement(ing|ation)?\b/.test(low) ||
    /\bfix(es|ed|ing)?\s+(the\s+)?(bug|issue)s?\b/.test(low) ||
    /\bship(ping)?\s+(the\s+)?/.test(low) ||
    /\bdeploy(ing|ment)?\b/.test(low) ||
    /\brefactor(ing)?\b/.test(low);

  const sv =
    /\bjag behöver\b/.test(low) ||
    /\bjag måste\b/.test(low) ||
    /\bvi behöver\b/.test(low) ||
    /\bvi måste\b/.test(low) ||
    /\bbehöver\s+(lägga till|implementera|fixa|bygga|uppdatera|skriva|byta|städa|slutföra)\b/.test(low) ||
    /\b(lägg till en funktion|lägg till funktion|ny funktion|funktionsönskemål)\b/.test(low) ||
    /\bimplementera\b/.test(low) ||
    /\bfixa\s+(bugg|buggen|felet|problemet)\b/.test(low) ||
    /\bska\s+(implementera|fixa|lägga till|bygga)\b/.test(low);

  return Boolean(en || sv);
}

function applyActionTaskDetectionGuardrails(
  item: OrganizedItemInput,
  options: { transcript: string; itemCount: number }
): OrganizedItemInput {
  if (item.item_type !== "note" && item.item_type !== "idea") return item;
  if (item.domain === "inbox") return item;

  const blob = `${item.title ?? ""} ${item.content ?? ""}`.replace(/\s+/g, " ").trim();
  const fromBlob = textSuggestsObligationOrBacklogTask(blob);
  const fromTranscript =
    options.itemCount === 1 && textSuggestsObligationOrBacklogTask(options.transcript);
  if (!fromBlob && !fromTranscript) return item;

  if (textSuggestsShoppingNotTask(blob) || (options.itemCount === 1 && textSuggestsShoppingNotTask(options.transcript))) {
    return item;
  }

  if (item.category === "feeling" || /\b(i feel|i'm feeling|jag känner|känner mig)\b/i.test(blob)) {
    return item;
  }

  let out: OrganizedItemInput = {
    ...item,
    item_type: "task",
    recommended_view:
      item.recommended_view === "kanban"
        ? "kanban"
        : item.recommended_view === "reflection_cards"
          ? "task_list"
          : "task_list",
  };
  delete out.scheduled_date;
  delete out.scheduled_time;

  if (out.domain === "personal" && (!out.category || out.category === "thoughts" || out.category === "projects")) {
    out = { ...out, category: "tasks" };
  }
  if (out.domain === "work" && (!out.category || out.category === "thoughts")) {
    out = { ...out, category: "tasks" };
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
  const refLocal = options.referenceLocalDate?.trim();
  const refLine =
    locale === "sv"
      ? `\n\nReferensdatum/tid (användarens "nu" för att tolka idag/imorgon): ${ref}${
          refLocal && /^\d{4}-\d{2}-\d{2}$/.test(refLocal)
            ? `\nAnvändarens **lokala kalenderdatum idag** (använd för "idag" när bara klockslag anges): ${refLocal}`
            : ""
        }`
      : `\n\nReference date/time (user's "now" for interpreting today/tomorrow): ${ref}${
          refLocal && /^\d{4}-\d{2}-\d{2}$/.test(refLocal)
            ? `\nUser's **local calendar date today** (use for "today" when only a clock time is given): ${refLocal}`
            : ""
        }`;

  let userContent =
    locale === "sv"
      ? `Transkript:\n\n${transcript}${refLine}\n\nSkriv title och content på svenska för varje post (om transkriptet är på svenska).`
      : `Transcript:\n\n${transcript}${refLine}`;

  const cp = options.chunkPart;
  if (cp && cp.total > 1) {
    userContent +=
      locale === "sv"
        ? `\n\n(Ovan är del ${cp.index} av ${cp.total} av samma brain dump — extrahera bara poster från denna text. Ignorera dubbletter av poster som redan fanns i en tidigare del om du skulle råka upprepa.)`
        : `\n\n(Above is part ${cp.index} of ${cp.total} of the same brain dump — extract items only from this segment. Avoid duplicating items that would have appeared in an earlier part.)`;
  }

  const maxOut =
    options.chunkPart && options.chunkPart.total > 1 ? 4096 : 2000;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.4,
    max_tokens: maxOut,
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
        // Only **task_due_date** counts for task deadlines — do not copy model `scheduled_date`
        // (often wrongly set to "today") when the user did not specify a day in the dump.
        const due = task_due_raw && /^\d{4}-\d{2}-\d{2}$/.test(task_due_raw) ? task_due_raw : undefined;
        delete base.scheduled_date;
        delete base.scheduled_time;
        if (due) {
          base.scheduled_date = due;
          const timeRaw = pickStr(raw, "scheduled_time", "scheduledTime");
          if (timeRaw && /^\d{1,2}:\d{2}$/.test(timeRaw)) {
            const [h, m] = timeRaw.split(":");
            base.scheduled_time = `${h!.padStart(2, "0")}:${m!}`;
          }
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
        const shopTimeRaw = pickStr(raw, "scheduled_time", "scheduledTime");
        if (shopTimeRaw && /^\d{1,2}:\d{2}$/.test(shopTimeRaw)) {
          const [h, m] = shopTimeRaw.split(":");
          base.scheduled_time = `${h!.padStart(2, "0")}:${m!}`;
        }
      }

      return applyActionTaskDetectionGuardrails(applyPersonalLogisticsGuardrails(base, options), {
        transcript,
        itemCount: items.length,
      });
    });
    const filteredItems = filterRedundantProjectCreationNotes(mappedItems, transcript, namesForEchoFilter);
    return { items: filteredItems, standaloneProjectCreations };
  } catch {
    return { items: [], standaloneProjectCreations: [] };
  }
}

/**
 * Chunk long transcripts, retry each OpenAI call, merge items and standalone project creations.
 */
export async function organizeTranscriptResilient(
  transcript: string,
  openaiApiKey: string,
  options: OrganizeOptions = {}
): Promise<OrganizeTranscriptResult> {
  const t = transcript.trim();
  if (!t) return { items: [], standaloneProjectCreations: [] };
  if (t.length > TRANSCRIPT_MAX_CHARS) {
    throw new Error(
      `Transcript is too long (max ${TRANSCRIPT_MAX_CHARS.toLocaleString()} characters). Shorten or split into multiple dumps.`
    );
  }

  const chunks =
    t.length <= CHUNK_TRIGGER_LENGTH ? [t] : splitTranscriptIntoChunks(t, CHUNK_TARGET_CHARS);
  if (chunks.length === 1) {
    return withRetry(() => organizeTranscript(t, openaiApiKey, options), 3, "Organization");
  }

  const allItems: OrganizedItemInput[] = [];
  const standaloneSeen = new Set<string>();
  const standaloneOut: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkOpts: OrganizeOptions = {
      ...options,
      chunkPart: { index: i + 1, total: chunks.length },
    };
    const part = chunks[i];
    const result = await withRetry(
      () => organizeTranscript(part, openaiApiKey, chunkOpts),
      3,
      `Organization part ${i + 1}/${chunks.length}`
    );
    allItems.push(...result.items);
    for (const s of result.standaloneProjectCreations) {
      const k = s.trim().toLowerCase();
      if (!k || standaloneSeen.has(k)) continue;
      standaloneSeen.add(k);
      standaloneOut.push(s.trim());
    }
    if (i < chunks.length - 1) await sleep(400);
  }

  return { items: allItems, standaloneProjectCreations: standaloneOut };
}
