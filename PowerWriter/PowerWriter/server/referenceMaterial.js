import AdmZip from "adm-zip";
import path from "path";
import pdfParse from "pdf-parse";

export const REFERENCE_DIR_SUFFIX = ".reference";
export const REFERENCE_MANIFEST = "manifest.json";
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

export function getReferenceDirAbsolute(documentAbsolutePath) {
  return `${documentAbsolutePath}${REFERENCE_DIR_SUFFIX}`;
}

export function sanitizeUploadFileName(name) {
  const base = path
    .basename(name || "upload")
    .replace(/[^\w.\- ()[\]]+/g, "_")
    .trim();
  return base || "upload.txt";
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

export async function extractPdfTextBuffer(buffer) {
  const parsed = await pdfParse(buffer);
  return (parsed.text || "").replace(/\u0000/g, "").trim();
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

function shouldExtractZipEntry(entryPath, buffer) {
  const ext = path.extname(entryPath).toLowerCase();
  if (ext === ".pdf") return true;
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (!ext && isLikelyTextBuffer(buffer)) return true;
  return false;
}

async function extractTextFromBuffer(buffer, entryPath) {
  const ext = path.extname(entryPath).toLowerCase();
  if (ext === ".pdf") {
    return extractPdfTextBuffer(buffer);
  }
  return buffer.toString("utf8").replace(/\u0000/g, "").trim();
}

export async function extractReferenceFromZipBuffer(buffer, sourceFileName) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const files = [];
  let skippedBinary = 0;
  const zipLabel = sanitizeUploadFileName(sourceFileName || "reference.zip");

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
      text = await extractTextFromBuffer(data, safePath);
    } catch {
      skippedBinary += 1;
      continue;
    }

    const trimmed = text.trim();
    if (!trimmed) continue;

    files.push({
      path: `${zipLabel}/${safePath}`,
      text: trimmed
    });
  }

  return { files, skippedBinary, sourceNames: [zipLabel] };
}

export async function extractReferenceFromUploadBuffer(buffer, originalName) {
  const safeName = sanitizeUploadFileName(originalName);
  const ext = path.extname(safeName).toLowerCase();

  if (ext === ".zip") {
    return extractReferenceFromZipBuffer(buffer, safeName);
  }

  if (ext === ".pdf") {
    const text = await extractPdfTextBuffer(buffer);
    if (!text) {
      throw new Error(`Could not extract text from PDF: ${safeName}`);
    }
    return {
      files: [{ path: safeName, text }],
      skippedBinary: 0,
      sourceNames: [safeName]
    };
  }

  if (TEXT_EXTENSIONS.has(ext) || isLikelyTextBuffer(buffer)) {
    const text = buffer.toString("utf8").replace(/\u0000/g, "").trim();
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

export function mergeReferenceFiles(existingFiles, incomingFiles) {
  const byPath = new Map();
  for (const file of existingFiles || []) {
    if (file?.path && file?.text) {
      byPath.set(file.path, { path: file.path, text: file.text });
    }
  }
  for (const file of incomingFiles || []) {
    if (file?.path && file?.text) {
      byPath.set(file.path, { path: file.path, text: file.text });
    }
  }
  return Array.from(byPath.values()).sort((a, b) =>
    a.path.localeCompare(b.path)
  );
}

export function buildReferenceManifest({
  sourceNames,
  files,
  skippedBinary = 0,
  previousManifest = null
}) {
  const mergedSourceNames = [
    ...new Set([
      ...(Array.isArray(previousManifest?.sourceNames)
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
    skippedBinary:
      (previousManifest?.skippedBinary || 0) + (skippedBinary || 0)
  };
}

export async function extractReferenceFromUploads(uploads) {
  const files = [];
  const sourceNames = [];
  let skippedBinary = 0;

  for (const upload of uploads) {
    if (!upload?.buffer?.length) continue;
    if (upload.buffer.length > MAX_REFERENCE_UPLOAD_BYTES) {
      throw new Error(
        `File too large (max ${MAX_REFERENCE_UPLOAD_BYTES / (1024 * 1024)} MB): ${
          upload.originalname || "upload"
        }`
      );
    }
    const part = await extractReferenceFromUploadBuffer(
      upload.buffer,
      upload.originalname || "upload"
    );
    files.push(...part.files);
    sourceNames.push(...part.sourceNames);
    skippedBinary += part.skippedBinary || 0;
  }

  if (files.length === 0) {
    throw new Error(
      "No usable reference text found. Upload .txt, .md, .pdf, or .zip archives containing those formats."
    );
  }

  return { files, sourceNames, skippedBinary };
}

export function buildReferencePromptContext(files, maxChars = MAX_REFERENCE_PROMPT_CHARS) {
  if (!files?.length) return "";

  const header = [
    "Reference material (examples, instructions, tips, and source notes uploaded by the author).",
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
