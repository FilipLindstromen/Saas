export const DEFAULT_WRITING_FALLBACK =
  "You help create clear, engaging written content. When folder or document instructions are provided, follow them strictly.";

export const DOCUMENT_GENERATE_TASK = `Write or update the document body according to the instruction layers in your system message.

- Match folder voice, format, and audience; apply document-specific requirements where they add or override detail.
- Use reference material for style, structure, and substance — produce original prose for this document.
- If a current draft is provided, improve and extend it coherently unless instructions or the task say to replace it entirely.

Output only the document content (no preambles, labels, or meta commentary).`;

export const DOCUMENT_REVIEW_TASK = `Review the current document against the folder and document instruction layers and any reference material provided.

Do **not** rewrite the full document. Provide editorial feedback on what could be adjusted.

Structure your response with clear headings, for example:
- **Alignment with instructions** — what matches or misses folder/document rules
- **Reference material** — gaps or opportunities compared to references
- **Suggested adjustments** — specific, actionable changes (tone, structure, clarity, accuracy, length)
- **Strengths** — what is already working well

Be concise but specific. Quote short phrases from the draft when helpful. If the document is empty or very short, explain what is missing relative to the instructions.`;

/**
 * @typedef {{ layer: "folder" | "document"; path: string; text: string }} InstructionSection
 */

/**
 * @param {InstructionSection[]} sections
 */
export function formatInstructionSections(sections) {
  if (!sections?.length) return "";
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

/**
 * @param {InstructionSection[]} sections
 */
export function buildGenerationSystemPrompt(sections) {
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

/**
 * @param {{ task: string; referenceContext?: string; documentContent?: string }} params
 */
export function buildGenerationUserContent(params) {
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

/**
 * @param {{ taskInstruction: string; referenceContext?: string; originalText: string }} params
 */
export function buildVariantUserContent(params) {
  const { taskInstruction, referenceContext, originalText } = params;
  return [
    "## Task",
    taskInstruction.trim(),
    referenceContext?.trim() ? `## Reference material\n${referenceContext.trim()}` : null,
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

export const VARIANT_SYSTEM_FALLBACK =
  "You rewrite passages while preserving the author's intent. Follow folder and document instructions when provided.";

/**
 * @param {InstructionSection[]} sections
 */
export function buildVariantSystemPrompt(sections) {
  const formatted = formatInstructionSections(sections);
  if (!formatted) {
    return `You are Power Writer, a precise editing assistant.\n\n${VARIANT_SYSTEM_FALLBACK}`;
  }
  return `${buildGenerationSystemPrompt(sections)}\n\nWhen rewriting, keep folder voice and document constraints; use reference material only as style guidance.`;
}
