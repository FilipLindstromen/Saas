import AdmZip from "adm-zip";
import path from "path";

export const REFERENCE_DIR_SUFFIX = ".reference";
export const REFERENCE_MANIFEST = "manifest.json";
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

export function getReferenceDirAbsolute(documentAbsolutePath) {
  return `${documentAbsolutePath}${REFERENCE_DIR_SUFFIX}`;
}

export function isLikelyTextBuffer(buffer) {
  if (!buffer || buffer.length === 0) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  let suspicious = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const byte = sample[i];
    if (byte === 0) return false;
    if (byte < 9 || (byte > 13 && byte < 32)) suspicious += 1;
  }
  return suspicious / sample.length < 0.05;
}

export function sanitizeZipEntryPath(entryName) {
  const normalized = entryName.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  const safe = [];
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

export function shouldExtractZipEntry(entryPath, buffer) {
  const ext = path.extname(entryPath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (!ext && isLikelyTextBuffer(buffer)) return true;
  return false;
}

export function extractReferenceFromZipBuffer(buffer, sourceFileName) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const files = [];
  let skippedBinary = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const safePath = sanitizeZipEntryPath(entry.entryName);
    if (!safePath) continue;

    const data = entry.getData();
    if (!shouldExtractZipEntry(safePath, data)) {
      skippedBinary += 1;
      continue;
    }

    let text;
    try {
      text = data.toString("utf8");
    } catch {
      skippedBinary += 1;
      continue;
    }

    const trimmed = text.replace(/\u0000/g, "").trim();
    if (!trimmed) continue;

    files.push({
      path: safePath,
      text: trimmed
    });
  }

  if (files.length === 0) {
    const hint =
      skippedBinary > 0
        ? " No readable text files found (supported: .txt, .md, .json, etc.; PDF/DOCX are not extracted yet)."
        : "";
    throw new Error(`The zip archive did not contain usable reference text.${hint}`);
  }

  const totalChars = files.reduce((sum, file) => sum + file.text.length, 0);
  const manifest = {
    uploadedAt: new Date().toISOString(),
    sourceFileName: sourceFileName || "reference.zip",
    files: files.map((file) => ({
      path: file.path,
      charCount: file.text.length
    })),
    totalChars,
    skippedBinary
  };

  return { manifest, files };
}

export function buildReferencePromptContext(files, maxChars = MAX_REFERENCE_PROMPT_CHARS) {
  if (!files?.length) return "";

  const header = [
    "Reference material (examples, instructions, tips, and source notes from the author's zip upload).",
    "Use this material to match style, structure, and quality, but write specifically for the current document, instructions, and prompt — do not copy verbatim unless quoting briefly.",
    ""
  ].join("\n");

  let budget = Math.max(0, maxChars - header.length - 64);
  const sections = [];

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
