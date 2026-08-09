export type InstructionSection = {
  layer: "folder" | "document";
  path: string;
  text: string;
};

export const DEFAULT_WRITING_FALLBACK =
  "You help create clear, engaging written content. When folder or document instructions are provided, follow them strictly.";

export const DOCUMENT_GENERATE_TASK = `Write or update the document body according to the instruction layers in your system message.

- Match folder voice, format, and audience; apply document-specific requirements where they add or override detail.
- Use reference material for style, structure, and substance — produce original prose for this document.
- If a current draft is provided, improve and extend it coherently unless instructions or the task say to replace it entirely.

Output only the document content (no preambles, labels, or meta commentary).`;

export const DOCUMENT_REVIEW_TASK = `Review the current document as a piece of writing. Use the folder and document instruction layers and any reference material only as background context for what this document is trying to be — do not report on how well it follows them.

Do **not** rewrite the full document. Provide editorial feedback on the content itself: tone, structure, clarity, pacing, accuracy, and length.

Structure your response with clear headings, for example:
- **Suggested adjustments** — specific, actionable changes to the writing
- **Strengths** — what is already working well

Do not include sections judging alignment with instructions or reference material (e.g. no "Alignment with instructions" or "Reference material" headings) — respond only to the content itself.

Be concise but specific. Quote short phrases from the draft when helpful. If the document is empty or very short, say so plainly.`;

export function formatInstructionSections(
  sections: InstructionSection[]
): string {
  if (!sections.length) return "";
  return sections
    .map((section) => {
      if (section.layer === "folder") {
        return `### Folder: ${section.path}\n${section.text}`;
      }
      const name = section.path.split("/").pop() || section.path;
      return `### Document: ${name}\n${section.text}`;
    })
    .join("\n\n");
}

export function buildGenerationSystemPrompt(
  sections: InstructionSection[]
): string {
  const framework = `You are Power Writer, an expert writing assistant.

## How instruction layers work
1. **Folder instructions** (ordered from parent folders down to nested folders) define shared audience, format, voice, and project rules for documents in that folder tree.
2. **Document instructions** apply only to the current document. When they conflict with folder instructions, **follow the document instructions**.
3. **Reference material** (in the user message under "Reference material") provides examples, research, and style targets. Learn from it; write originally for this document — do not copy long passages verbatim.
4. **Current document** (if provided) is the existing draft. Revise, continue, or replace it only as directed by the task and the instruction layers above.`;

  const formatted = formatInstructionSections(sections);
  if (!formatted) {
    return `${framework}\n\n## Default role\n${DEFAULT_WRITING_FALLBACK}`;
  }

  return `${framework}\n\n## Folder and document instructions\n\n${formatted}`;
}

export function buildGenerationUserContent(params: {
  task: string;
  referenceContext?: string;
  documentContent?: string;
}): string {
  const { task, referenceContext, documentContent } = params;
  const parts = [`## Task\n${task.trim()}`];

  if (referenceContext?.trim()) {
    parts.push(`## Reference material\n${referenceContext.trim()}`);
  }

  if (documentContent?.trim()) {
    parts.push(
      `## Current document\n${documentContent.trim()}\n\nTreat this as the working draft unless the task says otherwise.`
    );
  }

  return parts.join("\n\n");
}

export function buildVariantUserContent(params: {
  taskInstruction: string;
  referenceContext?: string;
  originalText: string;
}): string {
  const { taskInstruction, referenceContext, originalText } = params;
  return [
    "## Task",
    taskInstruction.trim(),
    referenceContext?.trim()
      ? `## Reference material\n${referenceContext.trim()}`
      : null,
    "## Original text",
    originalText.trim(),
    "",
    "Provide exactly three distinct variations that satisfy the task and honor the instruction layers.",
    "Respond strictly as JSON in the format:",
    '["Variant 1", "Variant 2", "Variant 3"]',
    "Do not include any additional commentary."
  ]
    .filter(Boolean)
    .join("\n");
}

const VARIANT_SYSTEM_FALLBACK =
  "You rewrite passages while preserving the author's intent. Follow folder and document instructions when provided.";

export function buildVariantSystemPrompt(
  sections: InstructionSection[]
): string {
  const formatted = formatInstructionSections(sections);
  if (!formatted) {
    return `You are Power Writer, a precise editing assistant.\n\n${VARIANT_SYSTEM_FALLBACK}`;
  }
  return `${buildGenerationSystemPrompt(sections)}\n\nWhen rewriting, keep folder voice and document constraints; use reference material only as style guidance.`;
}

export function gatherInstructionSectionsFromStorage(
  relativePath: string,
  type: "folder" | "document",
  getFolderInstructions: (path: string) => string,
  getDocumentInstructions: (path: string) => string
): InstructionSection[] {
  const sections: InstructionSection[] = [];
  const segments = relativePath ? relativePath.split("/").filter(Boolean) : [];

  if (type === "document" && segments.length > 0) {
    for (let i = 0; i < segments.length - 1; i += 1) {
      const folderPath = segments.slice(0, i + 1).join("/");
      const text = getFolderInstructions(folderPath).trim();
      if (text) {
        sections.push({ layer: "folder", path: folderPath, text });
      }
    }
    const docText = getDocumentInstructions(relativePath).trim();
    if (docText) {
      sections.push({ layer: "document", path: relativePath, text: docText });
    }
    return sections;
  }

  for (let i = 0; i < segments.length; i += 1) {
    const folderPath = segments.slice(0, i + 1).join("/");
    const text = getFolderInstructions(folderPath).trim();
    if (text) {
      sections.push({ layer: "folder", path: folderPath, text });
    }
  }

  return sections;
}
