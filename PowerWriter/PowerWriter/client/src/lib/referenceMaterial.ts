import JSZip from "jszip";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export type ReferenceMaterialSummary = {
  uploadedAt: string;
  sourceFileName: string;
  sourceNames?: string[];
  files: { path: string; charCount: number }[];
  totalChars: number;
  skippedBinary?: number;
};

export type ReferenceMaterialFile = {
  path: string;
  text: string;
};

export const MAX_REFERENCE_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_REFERENCE_FILES_PER_REQUEST = 50;
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

export function sanitizeUploadFileName(name: string): string {
  const base = (name.split(/[/\\]/).pop() || "upload")
    .replace(/[^\w.\- ()[\]]+/g, "_")
    .trim();
  return base || "upload.txt";
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

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const parts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) parts.push(line);
  }
  return parts.join("\n\n").replace(/\u0000/g, "").trim();
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
  if (ext === ".pdf") return true;
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (!ext && isLikelyText(bytes)) return true;
  return false;
}

async function extractTextFromBytes(
  bytes: Uint8Array,
  entryPath: string
): Promise<string> {
  const ext = getExtension(entryPath);
  if (ext === ".pdf") {
    return extractPdfText(bytes);
  }
  return new TextDecoder("utf-8", { fatal: false })
    .decode(bytes)
    .replace(/\u0000/g, "")
    .trim();
}

export async function extractReferenceFromZipFile(
  file: File
): Promise<{
  files: ReferenceMaterialFile[];
  skippedBinary: number;
  sourceNames: string[];
}> {
  if (file.size > MAX_REFERENCE_UPLOAD_BYTES) {
    throw new Error("Reference file is too large (max 50 MB).");
  }

  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const files: ReferenceMaterialFile[] = [];
  let skippedBinary = 0;
  const zipLabel = sanitizeUploadFileName(file.name || "reference.zip");

  for (const [entryName, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const safePath = sanitizeZipEntryPath(entryName);
    if (!safePath) continue;

    const bytes = await entry.async("uint8array");
    if (!shouldExtract(safePath, bytes)) {
      skippedBinary += 1;
      continue;
    }

    let text: string;
    try {
      text = await extractTextFromBytes(bytes, safePath);
    } catch {
      skippedBinary += 1;
      continue;
    }

    const trimmed = text.trim();
    if (!trimmed) continue;

    files.push({ path: `${zipLabel}/${safePath}`, text: trimmed });
  }

  return { files, skippedBinary, sourceNames: [zipLabel] };
}

export async function extractReferenceFromUploadFile(
  file: File
): Promise<{
  files: ReferenceMaterialFile[];
  skippedBinary: number;
  sourceNames: string[];
}> {
  if (file.size > MAX_REFERENCE_UPLOAD_BYTES) {
    throw new Error(`File too large (max 50 MB): ${file.name}`);
  }

  const safeName = sanitizeUploadFileName(file.name);
  const ext = getExtension(safeName);

  if (ext === ".zip") {
    return extractReferenceFromZipFile(file);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (ext === ".pdf" || (ext === "" && bytes[0] === 0x25 && bytes[1] === 0x50)) {
    const text = await extractPdfText(bytes);
    if (!text) {
      throw new Error(`Could not extract text from PDF: ${safeName}`);
    }
    return {
      files: [{ path: safeName, text }],
      skippedBinary: 0,
      sourceNames: [safeName]
    };
  }

  if (TEXT_EXTENSIONS.has(ext) || isLikelyText(bytes)) {
    const text = new TextDecoder("utf-8", { fatal: false })
      .decode(bytes)
      .replace(/\u0000/g, "")
      .trim();
    if (!text) {
      throw new Error(`File is empty or unreadable: ${safeName}`);
    }
    return {
      files: [{ path: safeName, text }],
      skippedBinary: 0,
      sourceNames: [safeName]
    };
  }

  throw new Error(`Unsupported file type: ${safeName}`);
}

export function mergeReferenceFiles(
  existingFiles: ReferenceMaterialFile[],
  incomingFiles: ReferenceMaterialFile[]
): ReferenceMaterialFile[] {
  const byPath = new Map<string, ReferenceMaterialFile>();
  for (const file of existingFiles) {
    if (file.path && file.text) byPath.set(file.path, file);
  }
  for (const file of incomingFiles) {
    if (file.path && file.text) byPath.set(file.path, file);
  }
  return Array.from(byPath.values()).sort((a, b) =>
    a.path.localeCompare(b.path)
  );
}

export function buildReferenceManifest(params: {
  sourceNames: string[];
  files: ReferenceMaterialFile[];
  skippedBinary?: number;
  previousManifest?: ReferenceMaterialSummary | null;
}): ReferenceMaterialSummary {
  const { sourceNames, files, skippedBinary = 0, previousManifest = null } =
    params;

  const mergedSourceNames = [
    ...new Set([
      ...(previousManifest?.sourceNames?.length
        ? previousManifest.sourceNames
        : previousManifest?.sourceFileName
        ? [previousManifest.sourceFileName]
        : []),
      ...sourceNames
    ])
  ];

  const label =
    mergedSourceNames.length <= 2
      ? mergedSourceNames.join(", ")
      : `${mergedSourceNames.length} uploads · ${files.length} files`;

  return {
    uploadedAt: new Date().toISOString(),
    sourceFileName: label || "reference files",
    sourceNames: mergedSourceNames,
    files: files.map((file) => ({
      path: file.path,
      charCount: file.text.length
    })),
    totalChars: files.reduce((sum, file) => sum + file.text.length, 0),
    skippedBinary: (previousManifest?.skippedBinary || 0) + skippedBinary
  };
}

export async function extractReferenceFromUploadFiles(
  uploads: File[]
): Promise<{
  files: ReferenceMaterialFile[];
  sourceNames: string[];
  skippedBinary: number;
}> {
  if (uploads.length === 0) {
    throw new Error("Select at least one file to upload.");
  }
  if (uploads.length > MAX_REFERENCE_FILES_PER_REQUEST) {
    throw new Error(
      `Too many files (max ${MAX_REFERENCE_FILES_PER_REQUEST} per upload).`
    );
  }

  const files: ReferenceMaterialFile[] = [];
  const sourceNames: string[] = [];
  let skippedBinary = 0;

  for (const file of uploads) {
    const part = await extractReferenceFromUploadFile(file);
    files.push(...part.files);
    sourceNames.push(...part.sourceNames);
    skippedBinary += part.skippedBinary;
  }

  if (files.length === 0) {
    throw new Error(
      "No usable reference text found. Upload .txt, .md, .pdf, or .zip archives containing those formats."
    );
  }

  return { files, sourceNames, skippedBinary };
}

export function buildReferencePromptContext(
  files: ReferenceMaterialFile[],
  maxChars = MAX_REFERENCE_PROMPT_CHARS
): string {
  if (!files.length) return "";

  const header = [
    "Reference material (examples, instructions, tips, and source notes uploaded by the author).",
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
