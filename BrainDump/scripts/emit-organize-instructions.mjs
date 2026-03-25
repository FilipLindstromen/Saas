/**
 * Regenerates src/lib/organize-instructions.json from organize-engine.ts template literals.
 * Run after editing prompts in organize-engine OR paste into the const blocks below when prompts live only in JSON.
 *
 * Usage: node scripts/emit-organize-instructions.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const enginePath = path.join(root, "src", "lib", "organize-engine.ts");
const outPath = path.join(root, "src", "lib", "organize-instructions.json");

function extractConst(src, name) {
  const re = new RegExp(
    `const ${name} = \\\`([\\s\\S]*?)\\\`;`,
    "m"
  );
  const m = src.match(re);
  if (!m) throw new Error(`Could not extract ${name} from organize-engine.ts`);
  return m[1].trimEnd();
}

const engineSrc = fs.readFileSync(enginePath, "utf8");
const organizeSystemPromptEn = extractConst(engineSrc, "ORGANIZE_SYSTEM_PROMPT");
const organizeSystemPromptSv = extractConst(engineSrc, "ORGANIZE_SYSTEM_PROMPT_SV");

const payload = {
  version: 1,
  description:
    "AI instructions for BrainDump. Edit organize prompts here or in organize-engine.ts and run: node scripts/emit-organize-instructions.mjs",
  organize: {
    systemPrompt: {
      en: organizeSystemPromptEn,
      sv: organizeSystemPromptSv,
    },
  },
  catalog: {
    en: {
      sectionHeader:
        "\n\n---\nCANONICAL APP CATALOG (always use exact spellings from these lists when a value appears here — avoids duplicate projects/areas):\n",
      workProjectsHeader:
        "\nWork projects (for domain=work, project_name MUST match one of these strings exactly when the user means that project — see rule 10 in the system prompt):\n",
      workCategoriesLabel:
        "\nWork categories/areas (prefer these labels for domain=work when they fit):\n",
      personalAreasLabel:
        "\nPersonal areas (prefer snake_case from this list for domain=personal):\n",
      inboxCategoriesLabel:
        "\nInbox categories (for domain=inbox when used):\n",
      userAddedAreasLabel:
        "\nUser-added area names (may apply to work or personal — reuse exact spelling when relevant):\n",
      defaultDomainWork: "\nDefault context for this session: \"work\". When classification is ambiguous, prefer this domain.\n",
      defaultDomainPersonal:
        "\nDefault context for this session: \"personal\". When classification is ambiguous, prefer this domain.\n",
    },
    sv: {
      sectionHeader:
        "\n\n---\nKANONISK APP-KATALOG (använd exakt stavning från dessa listor när värdet finns här — undvik dubbletter):\n",
      workProjectsHeader:
        "\nArbetsprojekt (för domain=work ska project_name matcha exakt ett av dessa namn när användaren menar projektet — se regel 10):\n",
      workCategoriesLabel:
        "\nArbetskategorier/områden (föredra dessa etiketter för domain=work):\n",
      personalAreasLabel:
        "\nPersonliga områden (föredra snake_case från listan för domain=personal):\n",
      inboxCategoriesLabel:
        "\nInkorg-kategorier (för domain=inbox):\n",
      userAddedAreasLabel:
        "\nAnvändartillagda områdesnamn (kan gälla arbete eller privat — återanvänd exakt stavning):\n",
      defaultDomainWork:
        "\nStandardkontext för denna session: \"work\". Vid tvekan om klassificering, föredra denna domain.\n",
      defaultDomainPersonal:
        "\nStandardkontext för denna session: \"personal\". Vid tvekan om klassificering, föredra denna domain.\n",
    },
  },
  transcribeImage: {
    en: {
      systemPrompt: `You transcribe images of notes, whiteboards, handwriting, screenshots, and printed text into plain text for a productivity app.
Rules:
- Output ONLY the transcribed text. No preamble, no "Here is...", no markdown fences unless the original clearly uses code blocks.
- Preserve line breaks, bullet points, and numbered lists when visible.
- If the text is in a non-English language, transcribe it in that language faithfully.
- If there is no readable text, reply exactly: (no text detected)`,
      langNoteSv:
        "Om texten är på svenska, transkribera den på svenska och behåll svensk stavning.",
      langNoteEn:
        "If the text is in a non-English language, transcribe it in that language faithfully.",
      userMessage: "Extract all readable text from this image.",
    },
    sv: {
      systemPrompt: null,
    },
  },
};

// Swedish uses same English system prompt for vision with langNote injected — kept in route logic
delete payload.transcribeImage.sv;

fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
console.log("Wrote", outPath);
