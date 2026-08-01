import JSZip from "jszip";

export type ReferenceMaterialSummary = {
  uploadedAt: string;
  sourceFileName: string;
  files: { path: string; charCount: number }[];
  totalChars: number;
  skippedBinary?: number;
};

export type ReferenceMaterialFile = {
  path: string;
  text: string;
};

export const MAX_REFERENCE_ZIP_BYTES = 50 * 1024 * 1024;
export const MAX_REFERENCE_PROMPT_CHARS = 120_000;

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".rst",
  ".csv",
  ".json",
  ".html",
  ".htm",
  ".xml",
  ".yaml",
  ".yml",
  ".tex",
  ".adoc",
  ".log",
  ".ini",
  ".cfg"
]);

const SKIP_DIR_NAMES = new Set([
  "__macosx",
  ".git",
  "node_modules",
  ".ds_store"
]);

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

function isLikelyText(bytes: Uint8Array): boolean {
  if (!bytes.length) return false;
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  let suspicious = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const byte = sample[i]!;
    if (byte === 0) return false;
    if (byte < 9 || (byte > 13 && byte < 32)) suspicious += 1;
  }
  return suspicious / sample.length < 0.05;
}

export function sanitizeZipEntryPath(entryName: string): string | null {
  const normalized = entryName.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  const safe: string[] = [];
  for (const segment of segments) {
    if (segment === ".." || segment === ".") {
      throw new Error("Invalid path in zip archive");
    }
    if (SKIP_DIR_NAMES.has(segment.toLowerCase())) {
      return null;
    }
    safe.push(segment);
  }
  if (safe.length === 0) return null;
  return safe.join("/");
}

function shouldExtract(entryPath: string, bytes: Uint8Array): boolean {
  const ext = getExtension(entryPath);
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (!ext && isLikelyText(bytes)) return true;
  return false;
}

export async function extractReferenceFromZipFile(
  file: File
): Promise<{ manifest: ReferenceMaterialSummary; files: ReferenceMaterialFile[] }> {
  if (file.size > MAX_REFERENCE_ZIP_BYTES) {
    throw new Error("Reference zip is too large (max 50 MB).");
  }

  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const files: ReferenceMaterialFile[] = [];
  let skippedBinary = 0;

  for (const [entryName, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const safePath = sanitizeZipEntryPath(entryName);
    if (!safePath) continue;

    const bytes = await entry.async("uint8array");
    if (!shouldExtract(safePath, bytes)) {
      skippedBinary += 1;
      continue;
    }

    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const trimmed = text.replace(/\u0000/g, "").trim();
    if (!trimmed) continue;

    files.push({ path: safePath, text: trimmed });
  }

  if (files.length === 0) {
    const hint =
      skippedBinary > 0
        ? " No readable text files found (supported: .txt, .md, .json, etc.; PDF/DOCX are not extracted yet)."
        : "";
    throw new Error(`The zip archive did not contain usable reference text.${hint}`);
  }

  const totalChars = files.reduce((sum, f) => sum + f.text.length, 0);
  const manifest: ReferenceMaterialSummary = {
    uploadedAt: new Date().toISOString(),
    sourceFileName: file.name || "reference.zip",
    files: files.map((f) => ({ path: f.path, charCount: f.text.length })),
    totalChars,
    skippedBinary
  };

  return { manifest, files };
}

export function buildReferencePromptContext(
  files: ReferenceMaterialFile[],
  maxChars = MAX_REFERENCE_PROMPT_CHARS
): string {
  if (!files.length) return "";

  const header = [
    "Reference material (examples, instructions, tips, and source notes from the author's zip upload).",
    "Use this material to match style, structure, and quality, but write specifically for the current document, instructions, and prompt — do not copy verbatim unless quoting briefly.",
    ""
  ].join("\n");

  let budget = Math.max(0, maxChars - header.length - 64);
  const sections: string[] = [];

  for (const file of files) {
    const label = `\n--- ${file.path} ---\n`;
    const remaining = budget - label.length;
    if (remaining <= 200) break;

    let body = file.text;
    if (body.length > remaining) {
      body = `${body.slice(0, remaining)}\n… [truncated]`;
    }
    sections.push(`${label}${body}`);
    budget -= label.length + body.length;
    if (budget <= 200) break;
  }

  if (!sections.length) return "";
  return `${header}${sections.join("\n")}`;
}
