import AdmZip from "adm-zip";
import path from "path";
import pdfParse from "pdf-parse";

export const REFERENCE_DIR_SUFFIX = ".reference";
export const FOLDER_REFERENCE_DIR_NAME = "_reference";
export const REFERENCE_MANIFEST = "manifest.json";
export const MAX_REFERENCE_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_REFERENCE_FILES_PER_REQUEST = 50;
export const MAX_REFERENCE_PROMPT_CHARS = 120_000;
export const MAX_REFERENCE_URL_BYTES = 2 * 1024 * 1024;
export const REFERENCE_URL_FETCH_TIMEOUT_MS = 20_000;
export const MAX_REFERENCE_URLS_PER_REQUEST = 5;

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

export function getFolderReferenceDirAbsolute(folderAbsolutePath) {
  return path.join(folderAbsolutePath, FOLDER_REFERENCE_DIR_NAME);
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
  const text = (parsed.text || "").replace(/\u0000/g, "").trim();
  if (!text) {
    throw new Error(
      "Could not extract text from this PDF (it may be scanned/image-only)."
    );
  }
  return text;
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

export function rebuildReferenceManifestFromFiles(files, previousManifest) {
  if (!files?.length) return null;
  const label =
    files.length === 1
      ? files[0].path.split("/").pop() || files[0].path
      : `${files.length} files`;
  return {
    uploadedAt: new Date().toISOString(),
    sourceFileName: label,
    sourceNames: previousManifest?.sourceNames,
    files: files.map((file) => ({
      path: file.path,
      charCount: file.text.length
    })),
    totalChars: files.reduce((sum, file) => sum + file.text.length, 0),
    skippedBinary: previousManifest?.skippedBinary
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

export function parseReferenceUrlInputs(input) {
  if (Array.isArray(input)) {
    return [
      ...new Set(input.map((value) => String(value).trim()).filter(Boolean))
    ];
  }
  if (typeof input === "string") {
    return [
      ...new Set(
        input
          .split(/[\n,]+/)
          .map((part) => part.trim())
          .filter(Boolean)
      )
    ];
  }
  return [];
}

export function normalizeReferenceUrl(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) {
    throw new Error("URL is required");
  }
  let url;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs are supported");
  }
  return url.href;
}

export function referencePathFromUrl(urlString) {
  const url = new URL(urlString);
  const host = url.hostname.replace(/[^\w.-]+/g, "_");
  let pathname = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!pathname) pathname = "index";
  pathname = pathname
    .replace(/[^\w./-]+/g, "_")
    .replace(/\.\./g, "_");
  const querySuffix = url.search
    ? `_${url.search
        .slice(1)
        .replace(/[^\w=&-]+/g, "_")
        .slice(0, 48)}`
    : "";
  return `web/${host}/${pathname}${querySuffix}.txt`;
}

export function htmlToPlainText(html) {
  let source = String(html || "");
  source = source
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const titleMatch = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? titleMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : "";

  source = source.replace(
    /<\/?(p|div|br|hr|h[1-6]|li|tr|td|th|section|article|header|footer|blockquote|main|aside|figure|figcaption)[^>]*>/gi,
    "\n"
  );
  source = source.replace(/<[^>]+>/g, " ");
  source = source
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

  source = source
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (title && !source.startsWith(title)) {
    source = `Title: ${title}\n\n${source}`;
  }
  return source;
}

export async function fetchReferenceFromUrl(urlInput) {
  const href = normalizeReferenceUrl(urlInput);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REFERENCE_URL_FETCH_TIMEOUT_MS
  );

  try {
    const response = await fetch(href, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "PowerWriterReferenceBot/1.0",
        Accept:
          "text/html,application/xhtml+xml,text/plain,text/markdown;q=0.9,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      throw new Error(`Could not fetch URL (HTTP ${response.status})`);
    }

    const contentType = response.headers.get("content-type") || "";
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_REFERENCE_URL_BYTES) {
      throw new Error(
        `Page too large (max ${MAX_REFERENCE_URL_BYTES / (1024 * 1024)} MB)`
      );
    }

    let text;
    if (
      contentType.includes("text/plain") ||
      contentType.includes("text/markdown")
    ) {
      text = buffer.toString("utf8").replace(/\u0000/g, "").trim();
    } else {
      text = htmlToPlainText(buffer.toString("utf8"));
    }

    if (!text || text.length < 80) {
      throw new Error(
        "Could not extract enough text from this page. Try a different URL or upload a file instead."
      );
    }

    const filePath = referencePathFromUrl(href);
    return {
      files: [{ path: filePath, text }],
      sourceNames: [href],
      skippedBinary: 0
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timed out fetching URL");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractReferenceFromUrls(urls) {
  const list = parseReferenceUrlInputs(urls);
  if (list.length === 0) {
    throw new Error("Enter at least one URL");
  }
  if (list.length > MAX_REFERENCE_URLS_PER_REQUEST) {
    throw new Error(
      `At most ${MAX_REFERENCE_URLS_PER_REQUEST} URLs per request`
    );
  }

  const files = [];
  const sourceNames = [];
  let skippedBinary = 0;

  for (const url of list) {
    const part = await fetchReferenceFromUrl(url);
    files.push(...part.files);
    sourceNames.push(...part.sourceNames);
    skippedBinary += part.skippedBinary || 0;
  }

  return { files, sourceNames, skippedBinary };
}

export function buildReferencePromptContext(files, maxChars = MAX_REFERENCE_PROMPT_CHARS) {
  if (!files?.length) return "";

  const header = [
    "Use the following as examples, research, and style guides. Match quality and structure where appropriate; write original content for the current document and task.",
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
