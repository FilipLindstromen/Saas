async function deleteNode(relativePath) {
  const target = resolveMeditationPath(relativePath);
  const stats = await fs.stat(target);

  if (stats.isDirectory()) {
    const entries = await fs.readdir(target);
    await Promise.all(
      entries.map((entry) => deleteNode(path.join(relativePath, entry)))
    );
    await fs.rmdir(target);
  } else {
    await fs.unlink(target);
    const instructionPath = `${target}${INSTRUCTIONS_SUFFIX}`;
    if (fsSync.existsSync(instructionPath)) {
      await fs.unlink(instructionPath);
    }
  }
}

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import multer from "multer";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import OpenAI from "openai";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const meditationDir = path.resolve(rootDir, "..", "MeditationWriter");

dotenv.config({ path: path.resolve(rootDir, "..", ".env") });

if (!fsSync.existsSync(meditationDir)) {
  fsSync.mkdirSync(meditationDir, { recursive: true });
}

const FOLDER_INSTRUCTIONS_FILE = "instructions.txt";
const INSTRUCTIONS_SUFFIX = ".instructions.txt";
const ORDER_FILE = "_order.json";
const FOLDER_COLOR_FILE = "_color.txt";
const DOCUMENT_META_SUFFIX = ".meta.json";
const AUDIO_SUFFIX = ".webm";
const AUDIO_DIRECTORY_NAME = "_audio";
const TRANSCRIPTION_SUFFIX = ".transcription.json";

const AUDIO_MIME_EXTENSIONS = new Map(
  Object.entries({
    "audio/webm": "webm",
    "audio/webm; codecs=opus": "webm",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/aac": "m4a"
  })
);

const VARIANT_MODE_INSTRUCTIONS = {
  simplify:
    "Simplify the text while preserving its meaning, tone, and key details. Make it easier to read without losing important information.",
  expand:
    "Expand the text with additional sensory detail and context while keeping the original voice and intent. Avoid repeating sentences verbatim.",
  rephrase:
    "Rephrase the text using different wording while keeping the same meaning, tone, and approximate length.",
  summarize:
    "Summarize the text in one or two graceful sentences that keep the core idea, emotional tone, and pacing.",
  punchUp:
    "Punch up the text by sharpening the imagery, tightening the pacing, and boosting dramatic impact while preserving the author’s intent.",
  sensory:
    "Enrich the text with vivid sensory detail, adding sounds, scents, textures, and visuals that immerse the reader without changing the core meaning."
};

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function resolveMeditationPath(relativePath = "") {
  const normalized = path.normalize(relativePath);
  const joined = path.resolve(meditationDir, normalized);
  if (!joined.startsWith(meditationDir)) {
    throw new Error("Invalid path");
  }
  return joined;
}

async function readTextIfExists(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content;
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

async function writeText(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function writeOptionalText(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const trimmed = (content ?? "").trim();
  if (!trimmed) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    return;
  }
  await fs.writeFile(filePath, trimmed, "utf8");
}

function getOrderFilePath(directoryPath) {
  return path.join(directoryPath, ORDER_FILE);
}

async function readOrderFile(directoryPath) {
  try {
    const content = await fs.readFile(getOrderFilePath(directoryPath), "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeOrderFile(directoryPath, order) {
  await fs.mkdir(directoryPath, { recursive: true });
  await fs.writeFile(
    getOrderFilePath(directoryPath),
    JSON.stringify(order, null, 2),
    "utf8"
  );
}

async function ensureInOrder(directoryPath, name) {
  const order = await readOrderFile(directoryPath);
  if (!order.includes(name)) {
    order.push(name);
    await writeOrderFile(directoryPath, order);
  }
}

async function removeFromOrder(directoryPath, name) {
  const order = await readOrderFile(directoryPath);
  const filtered = order.filter((entry) => entry !== name);
  if (filtered.length !== order.length) {
    await writeOrderFile(directoryPath, filtered);
  }
}

async function replaceInOrder(directoryPath, oldName, newName) {
  const order = await readOrderFile(directoryPath);
  const index = order.indexOf(oldName);
  if (index >= 0) {
    order[index] = newName;
    await writeOrderFile(directoryPath, order);
  }
}

async function reorderEntry(directoryPath, name, direction) {
  const order = await readOrderFile(directoryPath);
  const index = order.indexOf(name);
  if (index < 0) return;
  if (direction === "up" && index > 0) {
    [order[index - 1], order[index]] = [order[index], order[index - 1]];
    await writeOrderFile(directoryPath, order);
  }
  if (direction === "down" && index < order.length - 1) {
    [order[index], order[index + 1]] = [order[index + 1], order[index]];
    await writeOrderFile(directoryPath, order);
  }
}

function getParentRelativePath(relativePath) {
  const segments = relativePath.split("/").filter(Boolean);
  segments.pop();
  return segments.join("/");
}

function getDocumentMetaPath(documentAbsolutePath) {
  return `${documentAbsolutePath}${DOCUMENT_META_SUFFIX}`;
}

async function readDocumentMeta(documentAbsolutePath) {
  try {
    const raw = await fs.readFile(
      getDocumentMetaPath(documentAbsolutePath),
      "utf8"
    );
    const meta = JSON.parse(raw);
    return {
      completed: Boolean(meta?.completed),
      audioFileName:
        typeof meta?.audioFileName === "string" ? meta.audioFileName : null,
      recordings: Array.isArray(meta?.recordings) ? meta.recordings : null
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { completed: false, audioFileName: null, recordings: null };
    }
    throw error;
  }
}

async function writeDocumentMeta(documentAbsolutePath, meta) {
  const filePath = getDocumentMetaPath(documentAbsolutePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const existing = await readDocumentMeta(documentAbsolutePath);
  const next = { ...existing };
  if (Object.prototype.hasOwnProperty.call(meta, "completed")) {
    next.completed = Boolean(meta.completed);
  }
  if (Object.prototype.hasOwnProperty.call(meta, "audioFileName")) {
    next.audioFileName =
      typeof meta.audioFileName === "string" ? meta.audioFileName : null;
  }
  if (Object.prototype.hasOwnProperty.call(meta, "recordings")) {
    next.recordings = Array.isArray(meta.recordings) ? meta.recordings : null;
  }
  console.info("[Audio] writeDocumentMeta", {
    documentAbsolutePath,
    filePath,
    next
  });
  await fs.writeFile(
    filePath,
    JSON.stringify(
      next,
      null,
      2
    ),
    "utf8"
  );
}

function getTranscriptionPath(documentAbsolutePath) {
  return documentAbsolutePath + TRANSCRIPTION_SUFFIX;
}

async function readTranscription(documentAbsolutePath) {
  try {
    const filePath = getTranscriptionPath(documentAbsolutePath);
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeTranscription(documentAbsolutePath, transcription) {
  const filePath = getTranscriptionPath(documentAbsolutePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify(transcription, null, 2),
    "utf8"
  );
}

function getDocumentAudioAbsolutePath(documentAbsolutePath, fileName) {
  const parentDirectory = path.dirname(documentAbsolutePath);
  if (fileName.includes("/") || fileName.includes("\\")) {
    return path.join(parentDirectory, fileName);
  }
  return path.join(parentDirectory, AUDIO_DIRECTORY_NAME, fileName);
}

function inferAudioExtension(file) {
  const allowed = new Set([".webm", ".wav", ".mp3", ".ogg", ".m4a"]);
  if (file?.originalname) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.has(ext)) {
      return ext;
    }
  }
  const fromMap = AUDIO_MIME_EXTENSIONS.get(file?.mimetype?.toLowerCase?.() ?? "");
  if (fromMap) {
    return `.${fromMap}`;
  }
  return ".webm";
}

async function removeExistingAudio(documentAbsolutePath, meta) {
  if (!meta?.audioFileName) {
    console.info("[Audio] No prior recording to remove", {
      documentAbsolutePath
    });
    return;
  }
  const existingPath = getDocumentAudioAbsolutePath(
    documentAbsolutePath,
    meta.audioFileName
  );
  console.info("[Audio] Removing old recording", {
    documentAbsolutePath,
    audioFile: meta.audioFileName,
    existingPath
  });
  await fs.rm(existingPath, { force: true });
  try {
    const directory = path.dirname(existingPath);
    const audioDirectory = path.join(
      path.dirname(documentAbsolutePath),
      AUDIO_DIRECTORY_NAME
    );
    if (path.normalize(directory) !== path.normalize(audioDirectory)) {
      console.info("[Audio] Old recording was not in managed directory");
      return;
    }
    const contents = await fs.readdir(directory);
    if (contents.length === 0) {
      await fs.rmdir(directory);
    }
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
      throw error;
    }
  }
}

function sanitizeAudioBaseName(name) {
  const normalized = name.normalize("NFKD");
  const stripped = normalized.replace(/[\\/:*?"<>|]/g, "").trim();
  return stripped || "recording";
}

async function buildAudioFileName(documentAbsolutePath, extensionWithDot, append = false) {
  const baseDocumentName = path.basename(
    documentAbsolutePath,
    path.extname(documentAbsolutePath)
  );
  const safeBase = sanitizeAudioBaseName(baseDocumentName);
  const ext = extensionWithDot.startsWith(".")
    ? extensionWithDot
    : `.${extensionWithDot}`;
  
  if (append) {
    // Find the next available number
    const audioDirectory = path.join(
      path.dirname(documentAbsolutePath),
      AUDIO_DIRECTORY_NAME
    );
    let counter = 1;
    let fileName;
    do {
      fileName = `${safeBase}_${counter}${ext}`;
      const filePath = path.join(audioDirectory, fileName);
      try {
        await fs.access(filePath);
        counter++;
      } catch {
        break; // File doesn't exist, use this name
      }
    } while (true);
    return fileName;
  }
  
  return `${safeBase}${ext}`;
}

async function saveDocumentAudioFile(documentAbsolutePath, file, append = false) {
  console.info("[Audio] saveDocumentAudioFile:start", {
    documentAbsolutePath,
    mimeType: file.mimetype,
    size: file.size,
    append
  });
  const meta = await readDocumentMeta(documentAbsolutePath);
  if (!append) {
    await removeExistingAudio(documentAbsolutePath, meta);
  }
  const extension = inferAudioExtension(file);
  const fileName = await buildAudioFileName(documentAbsolutePath, extension, append);
  const audioDirectory = path.join(
    path.dirname(documentAbsolutePath),
    AUDIO_DIRECTORY_NAME
  );
  await fs.mkdir(audioDirectory, { recursive: true });
  const absoluteTarget = path.join(audioDirectory, fileName);
  await fs.writeFile(absoluteTarget, file.buffer);
  
  // Update recordings array in meta
  const existingRecordings = meta?.recordings || [];
  const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const stats = await fs.stat(absoluteTarget);
  const version = Math.floor(stats.mtimeMs).toString(36);
  const audioUrl = `/api/document/audio?path=${encodeURIComponent(toPosix(path.relative(meditationDir, documentAbsolutePath)))}&file=${encodeURIComponent(fileName)}&v=${version}`;
  
  const newRecording = {
    id: recordingId,
    audioUrl: audioUrl,
    audioFileName: fileName,
    type: file.mimetype.startsWith("video/") ? "audio+video" : "audio",
    createdAt: Date.now()
  };
  
  // If it's a video file, also save video info
  if (file.mimetype.startsWith("video/")) {
    newRecording.videoUrl = audioUrl; // Same URL for now
    newRecording.videoFileName = fileName;
  }
  
  const updatedRecordings = [...existingRecordings, newRecording];
  
  // For backward compatibility, also set the latest as the main audioUrl
  await writeDocumentMeta(documentAbsolutePath, { 
    audioFileName: fileName,
    recordings: updatedRecordings
  });
  
  console.info("[Audio] saveDocumentAudioFile:complete", {
    absoluteTarget,
    fileName,
    mtimeMs: stats.mtimeMs,
    recordingId
  });
  return {
    fileName,
    version,
    recordingId,
    audioUrl,
    recording: newRecording
  };
}

async function renameIfExists(oldPath, newPath) {
  try {
    await fs.mkdir(path.dirname(newPath), { recursive: true });
    await fs.rename(oldPath, newPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function shouldSkipEntry(name) {
  return (
    name === ORDER_FILE ||
    name === FOLDER_INSTRUCTIONS_FILE ||
    name === FOLDER_COLOR_FILE ||
    name.endsWith(INSTRUCTIONS_SUFFIX) ||
    name.endsWith(DOCUMENT_META_SUFFIX)
  );
}

async function listTree(currentDir = meditationDir, relative = "") {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const order = await readOrderFile(currentDir);
  const entryMap = new Map();

  for (const entry of entries) {
    if (shouldSkipEntry(entry.name)) continue;
    entryMap.set(entry.name, entry);
  }

  const orderedNames = [];
  for (const name of order) {
    if (entryMap.has(name)) {
      orderedNames.push(name);
    }
  }
  for (const name of entryMap.keys()) {
    if (!orderedNames.includes(name)) {
      orderedNames.push(name);
    }
  }

  const nodes = [];

  for (const name of orderedNames) {
    const entry = entryMap.get(name);
    if (!entry) continue;
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.join(relative, entry.name);

    if (entry.isDirectory()) {
      await ensureInOrder(currentDir, entry.name);
      const children = await listTree(absolutePath, relativePath);
      const instructionsPath = path.join(
        absolutePath,
        FOLDER_INSTRUCTIONS_FILE
      );
      const colorPath = path.join(absolutePath, FOLDER_COLOR_FILE);
      const instructions = await readTextIfExists(instructionsPath);
      const color = (await readTextIfExists(colorPath)).trim() || null;
      nodes.push({
        type: "folder",
        name: entry.name,
        path: toPosix(relativePath),
        instructions,
        color,
        children
      });
    } else if (entry.isFile() && entry.name.endsWith(".txt")) {
      await ensureInOrder(currentDir, entry.name);
      const instructionsPath = path.join(
        currentDir,
        `${entry.name}${INSTRUCTIONS_SUFFIX}`
      );
      const instructions = await readTextIfExists(instructionsPath);
      const meta = await readDocumentMeta(absolutePath);
      nodes.push({
        type: "document",
        name: entry.name,
        path: toPosix(relativePath),
        instructions,
        completed: Boolean(meta.completed)
      });
    }
  }

  return nodes;
}

async function getFolderInstructions(relativePath) {
  const folderPath = resolveMeditationPath(relativePath);
  const instructionsPath = path.join(folderPath, FOLDER_INSTRUCTIONS_FILE);
  return readTextIfExists(instructionsPath);
}

async function getDocumentInstructions(relativePath) {
  const docPath = resolveMeditationPath(relativePath);
  const instructionsPath = `${docPath}${INSTRUCTIONS_SUFFIX}`;
  return readTextIfExists(instructionsPath);
}

async function gatherAggregatedInstructions(relativePath, type) {
  const segments = relativePath ? relativePath.split("/") : [];
  const collected = [];

  for (let i = 0; i < segments.length; i += 1) {
    const segmentPath = segments.slice(0, i + 1).join("/");
    const fullPath = resolveMeditationPath(segmentPath);
    if (fsSync.existsSync(fullPath) && fsSync.statSync(fullPath).isDirectory()) {
      const text = await getFolderInstructions(segmentPath);
      if (text.trim()) {
        collected.push(text.trim());
      }
    }
  }

  if (type === "document") {
    const documentInstructions = (await getDocumentInstructions(relativePath)).trim();
    if (documentInstructions) {
      collected.push(documentInstructions);
    }
  }

  return collected.filter(Boolean).join("\n\n");
}

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

app.get("/api/tree", async (_req, res) => {
  try {
    const nodes = await listTree();
    res.json(nodes);
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to read tree"
    );
  }
});

app.get("/api/folder", async (req, res) => {
  try {
    const { path: relative } = req.query;
    const safePath = typeof relative === "string" ? relative : "";
    const folderPath = resolveMeditationPath(safePath);
    const stat = await fs.stat(folderPath);
    if (!stat.isDirectory()) {
      return res.status(400).send("Path is not a folder");
    }
    const instructions = await getFolderInstructions(safePath);
    const color = (
      await readTextIfExists(path.join(folderPath, FOLDER_COLOR_FILE))
    ).trim();
    const aggregated = await gatherAggregatedInstructions(safePath, "folder");
    res.json({
      name: path.basename(folderPath),
      path: toPosix(safePath),
      instructions,
      aggregatedInstructions: aggregated,
      color: color || null
    });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to load folder"
    );
  }
});

app.post("/api/folder", async (req, res) => {
  try {
    const {
      path: relative,
      instructions = "",
      color = ""
    } = req.body;
    if (typeof relative !== "string") {
      return res.status(400).send("Missing folder path");
    }
    const folderPath = resolveMeditationPath(relative);
    const stat = await fs.stat(folderPath);
    if (!stat.isDirectory()) {
      return res.status(400).send("Path is not a folder");
    }
    const instructionsPath = path.join(folderPath, FOLDER_INSTRUCTIONS_FILE);
    await writeText(instructionsPath, instructions);
    await writeOptionalText(path.join(folderPath, FOLDER_COLOR_FILE), color);
    res.json({ success: true });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to save folder"
    );
  }
});

app.post("/api/folder/create", async (req, res) => {
  try {
    const { parentPath, name } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).send("Missing folder name");
    }

    const parent = typeof parentPath === "string" ? parentPath : "";
    const target = path.join(parent, name);
    const folderPath = resolveMeditationPath(target);
    await fs.mkdir(folderPath, { recursive: true });
    const parentAbsolute = resolveMeditationPath(parent);
    await ensureInOrder(parentAbsolute, name);
    res.json({ success: true, path: toPosix(target) });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to create folder"
    );
  }
});

app.get("/api/document", async (req, res) => {
  try {
    const { path: relative } = req.query;
    if (typeof relative !== "string") {
      return res.status(400).send("Missing document path");
    }
    const documentPath = resolveMeditationPath(relative);
    const stat = await fs.stat(documentPath);
    if (!stat.isFile()) {
      return res.status(400).send("Path is not a file");
    }

    const [content, instructions, aggregated, meta, transcription] =
      await Promise.all([
        readTextIfExists(documentPath),
        getDocumentInstructions(relative),
        gatherAggregatedInstructions(relative, "document"),
        readDocumentMeta(documentPath),
        readTranscription(documentPath)
      ]);

    let audioUrl = null;
    if (meta.audioFileName) {
      const audioPath = getDocumentAudioAbsolutePath(
        documentPath,
        meta.audioFileName
      );
      try {
        const stats = await fs.stat(audioPath);
        const version = Math.floor(stats.mtimeMs).toString(36);
        audioUrl = `/api/document/audio?path=${encodeURIComponent(
          toPosix(relative)
        )}&v=${version}`;
      } catch (error) {
        audioUrl = null;
      }
    }

    res.json({
      name: path.basename(documentPath),
      path: toPosix(relative),
      content,
      instructions,
      aggregatedInstructions: aggregated,
      completed: Boolean(meta.completed),
      audioUrl,
      audioFileName: meta.audioFileName ?? null,
      recordings: meta.recordings || null,
      transcription: transcription || null
    });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to load document"
    );
  }
});

app.post("/api/document", async (req, res) => {
  try {
    const {
      path: relative,
      content = "",
      instructions = "",
      completed
    } = req.body;
    if (typeof relative !== "string") {
      return res.status(400).send("Missing document path");
    }
    const documentPath = resolveMeditationPath(relative);
    await writeText(documentPath, content);
    await writeText(`${documentPath}${INSTRUCTIONS_SUFFIX}`, instructions);
    if (typeof completed === "boolean") {
      await writeDocumentMeta(documentPath, { completed });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to save document"
    );
  }
});

app.get("/api/document/audio", async (req, res) => {
  try {
    const { path: relative } = req.query;
    if (typeof relative !== "string") {
      return res.status(400).send("Missing document path");
    }
    const documentPath = resolveMeditationPath(relative);
    const stat = await fs.stat(documentPath);
    if (!stat.isFile()) {
      return res.status(400).send("Path is not a file");
    }
    const meta = await readDocumentMeta(documentPath);
    if (!meta.audioFileName) {
      return res.status(404).send("No audio found for this document");
    }
    const audioAbsolute = getDocumentAudioAbsolutePath(
      documentPath,
      meta.audioFileName
    );
    await fs.access(audioAbsolute);
    res.sendFile(audioAbsolute);
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to load audio"
    );
  }
});

app.post(
  "/api/document/audio",
  upload.single("audio"),
  async (req, res) => {
    try {
      const { path: relative, append } = req.body ?? {};
      const shouldAppend = append === "true" || append === true;
      console.info("[Audio] Incoming upload", {
        relative,
        mimeType: req.file?.mimetype,
        size: req.file?.size,
        append: shouldAppend
      });
      if (typeof relative !== "string") {
        console.warn("[Audio] Missing document path in request body");
        return res.status(400).send("Missing document path");
      }
      if (!req.file) {
        console.warn("[Audio] No file attached to upload request", {
          relative
        });
        return res.status(400).send("Missing audio file");
      }
      const documentPath = resolveMeditationPath(relative);
      const stat = await fs.stat(documentPath);
      if (!stat.isFile()) {
        console.warn("[Audio] Target path is not a file", { relative });
        return res.status(400).send("Path is not a file");
      }
      console.info("[Audio] Saving recording", {
        documentPath,
        bytes: req.file.size,
        append: shouldAppend
      });
      const { fileName, version, recordingId, audioUrl, recording } = await saveDocumentAudioFile(
        documentPath,
        req.file,
        shouldAppend
      );
      console.info("[Audio] Saved recording", {
        relative,
        fileName,
        version,
        recordingId
      });
      res.json({
        success: true,
        audioUrl: audioUrl,
        audioFileName: fileName,
        recordingId,
        recording
      });
    } catch (error) {
      console.error("[Audio] Failed to save recording", {
        error,
        stack: error?.stack
      });
      res.status(500).send(
        error instanceof Error ? error.message : "Unable to save audio"
      );
    }
  }
);

app.post(
  "/api/document/audio/upload-enhanced",
  upload.single("audio"),
  async (req, res) => {
    try {
      console.info("[Audio Enhance Upload] Request received", {
        body: req.body,
        hasFile: !!req.file,
        fileSize: req.file?.size,
        fileMimetype: req.file?.mimetype,
        fileFieldname: req.file?.fieldname
      });
      
      const relative = req.body?.path;
      console.info("[Audio Enhance Upload] Extracted path", { relative, bodyKeys: Object.keys(req.body || {}) });
      
      if (!relative || typeof relative !== "string") {
        console.warn("[Audio Enhance Upload] Missing or invalid document path", {
          relative,
          body: req.body
        });
        return res.status(400).json({ error: "Missing document path", received: req.body });
      }
      
      if (!req.file) {
        console.warn("[Audio Enhance Upload] No file attached to upload request", {
          relative,
          body: req.body
        });
        return res.status(400).json({ error: "Missing audio file" });
      }
      
      const documentPath = resolveMeditationPath(relative);
      console.info("[Audio Enhance Upload] Resolved document path", { relative, documentPath });
      
      let stat;
      try {
        stat = await fs.stat(documentPath);
      } catch (statError) {
        console.error("[Audio Enhance Upload] Failed to stat document", {
          relative,
          documentPath,
          error: statError
        });
        return res.status(404).json({ error: "Document not found", path: relative });
      }
      
      if (!stat.isFile()) {
        console.warn("[Audio Enhance Upload] Target path is not a file", { relative, documentPath });
        return res.status(400).json({ error: "Path is not a file" });
      }
      
      console.info("[Audio Enhance Upload] Saving enhanced audio", {
        documentPath,
        bytes: req.file.size
      });
      
      // Save as enhanced version
      const meta = await readDocumentMeta(documentPath);
      if (!meta.audioFileName) {
        return res.status(400).json({ error: "No original audio file found for this document" });
      }
      
      // Get audio directory
      const audioDirectory = path.join(
        path.dirname(documentPath),
        AUDIO_DIRECTORY_NAME
      );
      await fs.mkdir(audioDirectory, { recursive: true });
      
      // Build enhanced filename
      const audioExt = path.extname(meta.audioFileName);
      const audioBasename = path.basename(meta.audioFileName, audioExt);
      const enhancedAudioFileName = `${audioBasename}_enhanced${audioExt}`;
      const absoluteTarget = path.join(audioDirectory, enhancedAudioFileName);
      
      // Save the enhanced audio file
      await fs.writeFile(absoluteTarget, req.file.buffer);
      
      // Get file stats for version
      const stats = await fs.stat(absoluteTarget);
      const version = Math.floor(stats.mtimeMs).toString(36);
      
      // Update metadata to use enhanced audio
      const newMeta = {
        ...meta,
        audioFileName: enhancedAudioFileName
      };
      await writeDocumentMeta(documentPath, newMeta);
      
      console.info("[Audio Enhance Upload] Saved enhanced audio", {
        relative,
        fileName: enhancedAudioFileName,
        version
      });
      
      res.json({
        success: true,
        audioUrl: `/api/document/audio?path=${encodeURIComponent(
          toPosix(relative)
        )}&file=${encodeURIComponent(enhancedAudioFileName)}&v=${version}`,
        audioFileName: enhancedAudioFileName
      });
    } catch (error) {
      console.error("[Audio Enhance Upload] Failed to save enhanced audio", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        code: error?.code,
        body: req.body,
        hasFile: !!req.file
      });
      res.status(500).json({
        error: "Failed to save enhanced audio",
        message: error instanceof Error ? error.message : "Unable to save audio",
        details: process.env.NODE_ENV === "development" ? {
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined
        } : undefined
      });
    }
  }
);

app.post("/api/document/transcription", async (req, res) => {
  try {
    const { path: relative, transcription } = req.body;
    if (typeof relative !== "string") {
      return res.status(400).send("Missing document path");
    }
    if (!transcription) {
      return res.status(400).send("Missing transcription");
    }
    const documentPath = resolveMeditationPath(relative);
    await writeTranscription(documentPath, transcription);
    res.json({ success: true });
  } catch (error) {
    console.error("[Transcription] Failed to save transcription", {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to save transcription"
    );
  }
});

app.post("/api/document/transcribe", async (req, res) => {
  try {
    const { path: relative } = req.body;
    if (typeof relative !== "string") {
      return res.status(400).send("Missing document path");
    }

    const documentPath = resolveMeditationPath(relative);
    const stat = await fs.stat(documentPath);
    if (!stat.isFile()) {
      return res.status(400).send("Path is not a file");
    }

    const meta = await readDocumentMeta(documentPath);
    if (!meta.audioFileName) {
      return res.status(400).send("No audio file found for this document");
    }

    const audioPath = getDocumentAudioAbsolutePath(
      documentPath,
      meta.audioFileName
    );
    const audioBuffer = await fs.readFile(audioPath);

    const headerKey = req.headers["x-openai-key"];
    const providedKey =
      typeof headerKey === "string"
        ? headerKey.trim()
        : Array.isArray(headerKey)
        ? headerKey[0]?.trim()
        : "";
    const effectiveKey = providedKey || envApiKey;

    if (!effectiveKey) {
      return res
        .status(400)
        .send(
          "OpenAI API key is not configured. Add one in settings or set OPENAI_API_KEY."
        );
    }

    const client = new OpenAI({ apiKey: effectiveKey });

    console.info("[Transcription] Starting transcription", {
      documentPath,
      audioSize: audioBuffer.length
    });

    const file = new File([audioBuffer], meta.audioFileName, {
      type: "audio/webm"
    });

    const transcription = await client.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word"]
    });

    console.info("[Transcription] Transcription complete", {
      documentPath,
      wordCount: transcription.words?.length || 0
    });

    const transcriptionData = {
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
      words: transcription.words || [],
      segments: transcription.segments || []
    };

    await writeTranscription(documentPath, transcriptionData);

    res.json({
      success: true,
      transcription: transcriptionData
    });
  } catch (error) {
    console.error("[Transcription] Failed to transcribe", {
      error,
      stack: error?.stack
    });
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to transcribe audio"
    );
  }
});

app.post("/api/document/audio/edit", async (req, res) => {
  try {
    const { path: relative, segments } = req.body;
    if (typeof relative !== "string") {
      return res.status(400).send("Missing document path");
    }
    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).send("Invalid or empty segments array");
    }

    const documentPath = resolveMeditationPath(relative);
    const stat = await fs.stat(documentPath);
    if (!stat.isFile()) {
      return res.status(400).send("Path is not a file");
    }

    const meta = await readDocumentMeta(documentPath);
    if (!meta.audioFileName) {
      return res.status(400).send("No audio file found for this document");
    }

    const audioPath = getDocumentAudioAbsolutePath(
      documentPath,
      meta.audioFileName
    );
    
    console.info("[Audio Edit] Starting audio edit", {
      documentPath,
      segmentsCount: segments.length,
      segments
    });

    // Note: This requires ffmpeg to be installed
    // For now, we'll return an error explaining this requirement
    // TODO: Implement ffmpeg-based audio cutting
    
    // Validate segments
    for (const segment of segments) {
      if (
        typeof segment.start !== "number" ||
        typeof segment.end !== "number" ||
        segment.start < 0 ||
        segment.end <= segment.start
      ) {
        return res.status(400).send("Invalid segment format");
      }
    }

    // TODO: Implement ffmpeg-based audio editing
    // For now, return error indicating this feature requires ffmpeg
    return res.status(501).json({
      error: "Audio editing requires ffmpeg to be installed on the server",
      message:
        "This feature is not yet implemented. Please install ffmpeg and implement audio cutting/concatenation."
    });
  } catch (error) {
    console.error("[Audio Edit] Error:", error);
    res.status(500).json({
      error: "Failed to edit audio",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// AI Studio Sound - Professional audio enhancement using FFmpeg
app.post("/api/document/audio/enhance", async (req, res) => {
  try {
    const { path: relative } = req.body;
    if (typeof relative !== "string") {
      return res.status(400).send("Missing document path");
    }

    const documentPath = resolveMeditationPath(relative);
    const stat = await fs.stat(documentPath);
    if (!stat.isFile()) {
      return res.status(400).send("Path is not a file");
    }

    const meta = await readDocumentMeta(documentPath);
    if (!meta.audioFileName) {
      return res.status(400).send("No audio file found for this document");
    }

    const audioPath = getDocumentAudioAbsolutePath(
      documentPath,
      meta.audioFileName
    );
    
    console.info("[Audio Enhance] Starting professional audio enhancement", {
      documentPath,
      audioPath
    });

    // Check if audio file exists
    if (!fsSync.existsSync(audioPath)) {
      return res.status(404).json({
        error: "Audio file not found",
        message: `Audio file does not exist: ${audioPath}`
      });
    }

    // Check if ffmpeg is available
    try {
      await execAsync("ffmpeg -version", { timeout: 5000 });
    } catch (ffmpegCheckError) {
      console.error("[Audio Enhance] FFmpeg not found:", ffmpegCheckError);
      return res.status(501).json({
        error: "FFmpeg not found",
        message: "FFmpeg is required for audio enhancement. Please install ffmpeg and ensure it's available in your system PATH. " +
                 "Visit https://ffmpeg.org/download.html for installation instructions."
      });
    }

    // Create enhanced audio filename
    const audioExt = path.extname(meta.audioFileName);
    const audioBasename = path.basename(meta.audioFileName, audioExt);
    const enhancedAudioFileName = `${audioBasename}_enhanced${audioExt}`;
    const audioDir = path.dirname(audioPath);
    const enhancedAudioPath = path.join(audioDir, enhancedAudioFileName);

    try {
      // Professional audio enhancement chain using FFmpeg
      // This creates studio-quality audio with:
      // 1. High-pass filter (80Hz) - Removes low-frequency rumble and noise
      // 2. Low-pass filter (18kHz) - Removes high-frequency hiss
      // 3. Adaptive noise reduction (anlmdn) - Removes background noise while preserving speech
      // 4. Dynamic range compression (acompressor) - Smooths out volume variations
      // 5. EQ adjustments (aecho) - Subtle reverb removal and clarity enhancement
      // 6. Normalization (loudnorm) - Broadcast-standard loudness normalization (EBU R128)
      // 7. Limiter (alimiter) - Prevents clipping and ensures professional levels
      
      // Professional audio enhancement chain
      // Using a simpler but effective approach with proven filters
      const ffmpegCommand = `ffmpeg -i "${audioPath}" ` +
        `-af "` +
        // High-pass filter: Remove low-frequency rumble below 80Hz
        `highpass=f=80,` +
        // Low-pass filter: Remove high-frequency hiss above 18kHz
        `lowpass=f=18000,` +
        // Adaptive Non-Local Means Denoise - removes background noise while preserving speech
        `anlmdn=s=0.0003:r=0.00001,` +
        // Dynamic range compressor - smooths volume variations for consistent levels
        `acompressor=threshold=-24dB:ratio=4:attack=5:release=50,` +
        // Subtle EQ: boost presence frequencies (2-4kHz) for clarity
        `equalizer=f=2000:width_type=h:width=1000:g=2,` +
        // Reduce low-frequency mud (around 300Hz)
        `equalizer=f=300:width_type=h:width=200:g=-1.5,` +
        // Reduce harsh high frequencies (around 5kHz)
        `equalizer=f=5000:width_type=h:width=2000:g=-1,` +
        // Normalize audio levels to -16 LUFS (broadcast standard)
        `loudnorm=I=-16:TP=-1.5:LRA=11,` +
        // Limiter to prevent clipping and ensure professional levels (95% output)
        `alimiter=level_in=1:level_out=0.95:limit=0.9:attack=5:release=50" ` +
        `-c:a libopus -b:a 192k -ar 48000 ` +
        `"${enhancedAudioPath}" -y`;
      
      console.info("[Audio Enhance] Running FFmpeg enhancement");
      
      const { stdout, stderr } = await execAsync(ffmpegCommand, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 600000 // 10 minute timeout for complex processing
      });
      
      // FFmpeg writes progress to stderr, so we only log actual errors
      if (stderr && (stderr.includes("Error") || stderr.includes("error"))) {
        console.error("[Audio Enhance] FFmpeg error:", stderr);
        throw new Error(`FFmpeg processing failed: ${stderr.split('\n').filter(line => line.includes('Error')).join('; ')}`);
      }
      
      // Check if enhanced file was created
      if (!fsSync.existsSync(enhancedAudioPath)) {
        throw new Error("Enhanced audio file was not created after processing");
      }

      // Update document metadata to use enhanced audio
      const newMeta = {
        ...meta,
        audioFileName: enhancedAudioFileName
      };
      await writeDocumentMeta(documentPath, newMeta);

      const stats = await fs.stat(enhancedAudioPath);
      const version = Math.floor(stats.mtimeMs).toString(36);

      console.info("[Audio Enhance] Audio enhancement complete", {
        enhancedAudioPath,
        enhancedAudioFileName,
        fileSize: stats.size
      });

      res.json({
        success: true,
        audioUrl: `/api/document/audio?path=${encodeURIComponent(
          toPosix(relative)
        )}&file=${encodeURIComponent(enhancedAudioFileName)}&v=${version}`
      });
    } catch (enhanceError) {
      console.error("[Audio Enhance] Processing error:", enhanceError);
      
      // Check if enhanced file exists (partial file might have been created)
      if (fsSync.existsSync(enhancedAudioPath)) {
        try {
          await fs.unlink(enhancedAudioPath);
        } catch {}
      }
      
      // Return user-friendly error
      const errorMessage = enhanceError instanceof Error ? enhanceError.message : String(enhanceError);
      return res.status(500).json({
        error: "Audio enhancement failed",
        message: `Failed to enhance audio: ${errorMessage}`
      });
    }
  } catch (error) {
    console.error("[Audio Enhance] Error:", error);
    res.status(500).json({
      error: "Failed to enhance audio",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.get("/api/document/audio/export-mp3", async (req, res) => {
  try {
    const { path: relative } = req.query;
    if (typeof relative !== "string") {
      return res.status(400).send("Missing document path");
    }

    const documentPath = resolveMeditationPath(relative);
    const stat = await fs.stat(documentPath);
    if (!stat.isFile()) {
      return res.status(400).send("Path is not a file");
    }

    const meta = await readDocumentMeta(documentPath);
    if (!meta.audioFileName) {
      return res.status(404).json({ error: "No audio file found for this document" });
    }

    const audioPath = getDocumentAudioAbsolutePath(
      documentPath,
      meta.audioFileName
    );

    if (!fsSync.existsSync(audioPath)) {
      return res.status(404).json({ error: "Audio file not found" });
    }

    console.info("[Export MP3] Starting MP3 export", {
      documentPath,
      audioPath
    });

    // Check if ffmpeg is available
    try {
      await execAsync("ffmpeg -version", { timeout: 5000 });
    } catch (ffmpegCheckError) {
      console.error("[Export MP3] FFmpeg not found:", ffmpegCheckError);
      return res.status(501).json({
        error: "FFmpeg not found",
        message: "FFmpeg is required for MP3 export. Please install ffmpeg and ensure it's available in your system PATH."
      });
    }

    // Create temporary output path for MP3
    const audioExt = path.extname(meta.audioFileName);
    const audioBasename = path.basename(meta.audioFileName, audioExt);
    const tempDir = path.join(path.dirname(audioPath), "temp");
    await fs.mkdir(tempDir, { recursive: true });
    const tempMp3Path = path.join(tempDir, `${audioBasename}_export.mp3`);

    try {
      // Convert audio to MP3 using FFmpeg
      // Use high quality settings: 192k bitrate, high quality encoding
      const ffmpegCommand = `ffmpeg -i "${audioPath}" -codec:a libmp3lame -b:a 192k -q:a 0 "${tempMp3Path}" -y`;
      
      console.info("[Export MP3] Running ffmpeg conversion");
      
      const { stdout, stderr } = await execAsync(ffmpegCommand, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 300000 // 5 minute timeout
      });

      // FFmpeg writes progress to stderr, so we only log errors
      if (stderr && stderr.includes("Error")) {
        console.error("[Export MP3] FFmpeg error:", stderr);
        throw new Error(`FFmpeg conversion failed: ${stderr}`);
      }

      // Check if MP3 file was created
      if (!fsSync.existsSync(tempMp3Path)) {
        throw new Error("MP3 file was not created after conversion");
      }

      // Get file stats for proper headers
      const stats = await fs.stat(tempMp3Path);
      const fileName = `${path.basename(documentPath, path.extname(documentPath))}.mp3`;

      // Set headers for file download
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Length", stats.size);

      // Send the file
      const fileStream = fsSync.createReadStream(tempMp3Path);
      fileStream.pipe(res);

      // Clean up temp file after sending
      fileStream.on("end", async () => {
        try {
          await fs.unlink(tempMp3Path);
          // Remove temp directory if empty
          const tempFiles = await fs.readdir(tempDir);
          if (tempFiles.length === 0) {
            await fs.rmdir(tempDir);
          }
        } catch (cleanupError) {
          console.error("[Export MP3] Cleanup error:", cleanupError);
        }
      });

      console.info("[Export MP3] MP3 export complete", {
        fileName,
        size: stats.size
      });
    } catch (convertError) {
      console.error("[Export MP3] Conversion error:", convertError);
      
      // Clean up temp file if it exists
      if (fsSync.existsSync(tempMp3Path)) {
        try {
          await fs.unlink(tempMp3Path);
        } catch {}
      }

      const errorMessage = convertError instanceof Error ? convertError.message : String(convertError);
      return res.status(500).json({
        error: "MP3 export failed",
        message: `Failed to convert audio to MP3: ${errorMessage}`
      });
    }
  } catch (error) {
    console.error("[Export MP3] Error:", error);
    res.status(500).json({
      error: "Failed to export audio as MP3",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.post("/api/document/create", async (req, res) => {
  try {
    const { folderPath, name } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).send("Missing document name");
    }
    const folder = typeof folderPath === "string" ? folderPath : "";
    const target = path.join(folder, name);
    const documentPath = resolveMeditationPath(target);
    await writeText(documentPath, "");
    await writeDocumentMeta(documentPath, { completed: false });
    const parentAbsolute = resolveMeditationPath(folder);
    await ensureInOrder(parentAbsolute, name);
    res.json({ success: true, path: toPosix(target) });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to create document"
    );
  }
});

app.post("/api/folder/rename", async (req, res) => {
  try {
    const { path: relative, newName } = req.body;
    if (typeof relative !== "string" || typeof newName !== "string") {
      return res.status(400).send("Missing folder path or name");
    }
    if (newName.includes("/") || newName.includes("\\")) {
      return res.status(400).send("Folder name cannot contain slashes");
    }
    const parentRelative = getParentRelativePath(relative);
    const oldFolderPath = resolveMeditationPath(relative);
    const newRelativePath = path.join(parentRelative, newName);
    const newFolderPath = resolveMeditationPath(newRelativePath);
    await fs.rename(oldFolderPath, newFolderPath);
    const parentAbsolute = resolveMeditationPath(parentRelative);
    await replaceInOrder(
      parentAbsolute,
      path.basename(relative),
      newName
    );
    res.json({ success: true, path: toPosix(newRelativePath) });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to rename folder"
    );
  }
});

app.post("/api/document/rename", async (req, res) => {
  try {
    const { path: relative, newName } = req.body;
    if (typeof relative !== "string" || typeof newName !== "string") {
      return res.status(400).send("Missing document path or name");
    }
    if (newName.includes("/") || newName.includes("\\")) {
      return res.status(400).send("Document name cannot contain slashes");
    }
    const parentRelative = getParentRelativePath(relative);
    const oldDocumentPath = resolveMeditationPath(relative);
    const meta = await readDocumentMeta(oldDocumentPath);
    const newRelativePath = path.join(parentRelative, newName);
    const newDocumentPath = resolveMeditationPath(newRelativePath);
    await fs.rename(oldDocumentPath, newDocumentPath);
    await renameIfExists(
      `${oldDocumentPath}${INSTRUCTIONS_SUFFIX}`,
      `${newDocumentPath}${INSTRUCTIONS_SUFFIX}`
    );
    await renameIfExists(
      getDocumentMetaPath(oldDocumentPath),
      getDocumentMetaPath(newDocumentPath)
    );
    if (meta.audioFileName) {
      const oldAudioPath = getDocumentAudioAbsolutePath(
        oldDocumentPath,
        meta.audioFileName
      );
      const ext = path.extname(meta.audioFileName) || AUDIO_SUFFIX;
      const newAudioFileName = buildAudioFileName(newDocumentPath, ext);
      const newAudioPath = getDocumentAudioAbsolutePath(
        newDocumentPath,
        newAudioFileName
      );
      await renameIfExists(oldAudioPath, newAudioPath);
      await writeDocumentMeta(newDocumentPath, {
        audioFileName: newAudioFileName
      });
    }
    const parentAbsolute = resolveMeditationPath(parentRelative);
    await replaceInOrder(
      parentAbsolute,
      path.basename(relative),
      newName
    );
    res.json({ success: true, path: toPosix(newRelativePath) });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to rename document"
    );
  }
});

app.post("/api/folder/delete", async (req, res) => {
  try {
    const { path: relative } = req.body;
    if (typeof relative !== "string") {
      return res.status(400).send("Missing folder path");
    }
    const parentRelative = getParentRelativePath(relative);
    const folderPath = resolveMeditationPath(relative);
    await fs.rm(folderPath, { recursive: true, force: true });
    const parentAbsolute = resolveMeditationPath(parentRelative);
    await removeFromOrder(parentAbsolute, path.basename(relative));
    res.json({ success: true });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to delete folder"
    );
  }
});

app.post("/api/document/delete", async (req, res) => {
  try {
    const { path: relative } = req.body;
    if (typeof relative !== "string") {
      return res.status(400).send("Missing document path");
    }
    const parentRelative = getParentRelativePath(relative);
    const documentPath = resolveMeditationPath(relative);
    const meta = await readDocumentMeta(documentPath);
    await fs.rm(documentPath, { force: true });
    await fs.rm(`${documentPath}${INSTRUCTIONS_SUFFIX}`, { force: true });
    await fs.rm(getDocumentMetaPath(documentPath), { force: true });
    if (meta.audioFileName) {
      await fs.rm(
        getDocumentAudioAbsolutePath(documentPath, meta.audioFileName),
        { force: true }
      );
    }
    const parentAbsolute = resolveMeditationPath(parentRelative);
    await removeFromOrder(parentAbsolute, path.basename(relative));
    res.json({ success: true });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to delete document"
    );
  }
});

app.post("/api/folder/move", async (req, res) => {
  try {
    const { path: relative, targetParentPath } = req.body;
    if (typeof relative !== "string") {
      return res.status(400).send("Missing folder path");
    }
    const targetParent =
      typeof targetParentPath === "string" ? targetParentPath : "";
    if (
      relative === targetParent ||
      targetParent.startsWith(`${relative}/`)
    ) {
      return res.status(400).send("Cannot move folder into itself");
    }
    const name = path.basename(relative);
    const oldParent = getParentRelativePath(relative);
    const oldFolderPath = resolveMeditationPath(relative);
    const newRelativePath = path.join(targetParent, name);
    const newFolderPath = resolveMeditationPath(newRelativePath);
    await fs.rename(oldFolderPath, newFolderPath);
    const oldParentAbsolute = resolveMeditationPath(oldParent);
    const newParentAbsolute = resolveMeditationPath(targetParent);
    await removeFromOrder(oldParentAbsolute, name);
    await ensureInOrder(newParentAbsolute, name);
    res.json({ success: true, path: toPosix(newRelativePath) });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to move folder"
    );
  }
});

app.post("/api/document/move", async (req, res) => {
  try {
    const { path: relative, targetFolderPath } = req.body;
    if (typeof relative !== "string") {
      return res.status(400).send("Missing document path");
    }
    const targetFolder =
      typeof targetFolderPath === "string" ? targetFolderPath : "";
    const name = path.basename(relative);
    const oldParent = getParentRelativePath(relative);
    const documentPath = resolveMeditationPath(relative);
    const meta = await readDocumentMeta(documentPath);
    const newRelativePath = path.join(targetFolder, name);
    const newDocumentPath = resolveMeditationPath(newRelativePath);
    await fs.rename(documentPath, newDocumentPath);
    await renameIfExists(
      `${documentPath}${INSTRUCTIONS_SUFFIX}`,
      `${newDocumentPath}${INSTRUCTIONS_SUFFIX}`
    );
    await renameIfExists(
      getDocumentMetaPath(documentPath),
      getDocumentMetaPath(newDocumentPath)
    );
    if (meta.audioFileName) {
      await renameIfExists(
        getDocumentAudioAbsolutePath(documentPath, meta.audioFileName),
        getDocumentAudioAbsolutePath(newDocumentPath, meta.audioFileName)
      );
    }
    const oldParentAbsolute = resolveMeditationPath(oldParent);
    const newParentAbsolute = resolveMeditationPath(targetFolder);
    await removeFromOrder(oldParentAbsolute, name);
    await ensureInOrder(newParentAbsolute, name);
    res.json({ success: true, path: toPosix(newRelativePath) });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to move document"
    );
  }
});

app.post("/api/order", async (req, res) => {
  try {
    const { path: relative, direction } = req.body;
    if (typeof relative !== "string" || !["up", "down"].includes(direction)) {
      return res.status(400).send("Invalid reorder request");
    }
    const parentRelative = getParentRelativePath(relative);
    const parentAbsolute = resolveMeditationPath(parentRelative);
    const name = path.basename(relative);
    await reorderEntry(parentAbsolute, name, direction);
    res.json({ success: true });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to reorder"
    );
  }
});

app.post("/api/generate-variants", async (req, res) => {
  try {
    const { path: relative, text, mode } = req.body;
    const hasMode = Object.prototype.hasOwnProperty.call(
      VARIANT_MODE_INSTRUCTIONS,
      mode
    );
    if (
      typeof text !== "string" ||
      !text.trim() ||
      typeof mode !== "string" ||
      !hasMode
    ) {
      return res
        .status(400)
        .send("Mode or text missing. Modes: simplify, expand, rephrase.");
    }

    const headerKey = req.headers["x-openai-key"];
    const providedKey =
      typeof headerKey === "string"
        ? headerKey.trim()
        : Array.isArray(headerKey)
        ? headerKey[0]?.trim()
        : "";
    const effectiveKey = providedKey || envApiKey;

    if (!effectiveKey) {
      return res
        .status(400)
        .send(
          "OpenAI API key is not configured. Add one in settings or set OPENAI_API_KEY."
        );
    }

    const client = new OpenAI({ apiKey: effectiveKey });

    const pathString =
      typeof relative === "string" ? relative : relative ?? "";

    const aggregated =
      typeof relative === "string"
        ? await gatherAggregatedInstructions(
            pathString,
            pathString.endsWith(".txt") ? "document" : "folder"
          )
        : "";

    const systemPrompt =
      aggregated ||
      "You are a helpful writing assistant that rewrites user-provided passages.";

    const taskInstruction = VARIANT_MODE_INSTRUCTIONS[mode];

    const userPrompt = [
      `Task: ${taskInstruction}`,
      "Original text:",
      text.trim(),
      "",
      "Provide exactly three distinct variations that satisfy the task.",
      "Respond strictly as JSON in the format:",
      '["Variant 1", "Variant 2", "Variant 3"]',
      "Do not include any additional commentary."
    ].join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7
    });

    const rawContent =
      completion.choices?.[0]?.message?.content?.trim() ?? "[]";
    let variants;
    try {
      variants = JSON.parse(rawContent);
      if (!Array.isArray(variants)) {
        throw new Error("Expected JSON array");
      }
      variants = variants
        .filter((value) => typeof value === "string")
        .slice(0, 3);
    } catch (error) {
      return res
        .status(500)
        .send(
          `Unable to parse response from OpenAI. Received: ${rawContent.slice(
            0,
            200
          )}`
        );
    }

    res.json({ variants });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate variants";
    res.status(500).send(message);
  }
});

app.post("/api/rename", async (req, res) => {
  try {
    const { sourcePath, targetPath } = req.body;
    if (typeof sourcePath !== "string" || typeof targetPath !== "string") {
      return res.status(400).send("Invalid rename payload");
    }

    const from = resolveMeditationPath(sourcePath);
    const to = resolveMeditationPath(targetPath);

    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);

    if (from.endsWith(".txt")) {
      const fromInstructions = `${from}${INSTRUCTIONS_SUFFIX}`;
      const toInstructions = `${to}${INSTRUCTIONS_SUFFIX}`;
      if (fsSync.existsSync(fromInstructions)) {
        await fs.mkdir(path.dirname(toInstructions), { recursive: true });
        await fs.rename(fromInstructions, toInstructions);
      }
    } else {
      const fromInstructions = path.join(from, FOLDER_INSTRUCTIONS_FILE);
      const toInstructions = path.join(to, FOLDER_INSTRUCTIONS_FILE);
      if (fsSync.existsSync(fromInstructions)) {
        await fs.mkdir(path.dirname(toInstructions), { recursive: true });
        await fs.rename(fromInstructions, toInstructions);
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to rename item"
    );
  }
});

app.post("/api/move", async (req, res) => {
  try {
    const { sourcePath, destinationFolder } = req.body;
    if (typeof sourcePath !== "string" || typeof destinationFolder !== "string") {
      return res.status(400).send("Invalid move payload");
    }

    const name = path.basename(sourcePath);
    const targetPath = path.join(destinationFolder, name);

    const from = resolveMeditationPath(sourcePath);
    const to = resolveMeditationPath(targetPath);

    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);

    if (from.endsWith(".txt")) {
      const fromInstructions = `${from}${INSTRUCTIONS_SUFFIX}`;
      const toInstructions = `${to}${INSTRUCTIONS_SUFFIX}`;
      if (fsSync.existsSync(fromInstructions)) {
        await fs.mkdir(path.dirname(toInstructions), { recursive: true });
        await fs.rename(fromInstructions, toInstructions);
      }
    } else {
      const fromInstructions = path.join(from, FOLDER_INSTRUCTIONS_FILE);
      const toInstructions = path.join(to, FOLDER_INSTRUCTIONS_FILE);
      if (fsSync.existsSync(fromInstructions)) {
        await fs.mkdir(path.dirname(toInstructions), { recursive: true });
        await fs.rename(fromInstructions, toInstructions);
      }
    }

    res.json({ success: true, path: toPosix(targetPath) });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to move item"
    );
  }
});

app.post("/api/delete", async (req, res) => {
  try {
    const { path: relative } = req.body;
    if (typeof relative !== "string") {
      return res.status(400).send("Missing path to delete");
    }
    await deleteNode(relative);
    res.json({ success: true });
  } catch (error) {
    res.status(500).send(
      error instanceof Error ? error.message : "Unable to delete item"
    );
  }
});

const envApiKey = process.env.OPENAI_API_KEY?.trim() || null;

app.post("/api/generate", async (req, res) => {
  try {
    const { path: relative, prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).send("Prompt is required");
    }

    const pathString =
      typeof relative === "string" ? relative : relative ?? "";

    const headerKey = req.headers["x-openai-key"];
    const providedKey =
      typeof headerKey === "string"
        ? headerKey.trim()
        : Array.isArray(headerKey)
        ? headerKey[0]?.trim()
        : "";

    const effectiveKey = providedKey || envApiKey;

    if (!effectiveKey) {
      return res
        .status(400)
        .send(
          "OpenAI API key is not configured. Add one in settings or set OPENAI_API_KEY."
        );
    }

    const client = new OpenAI({ apiKey: effectiveKey });

    const aggregated =
      typeof relative === "string"
        ? await gatherAggregatedInstructions(
            pathString,
            pathString.endsWith(".txt") ? "document" : "folder"
          )
        : "";

    let documentContent = "";
    if (typeof relative === "string" && relative.endsWith(".txt")) {
      documentContent = await readTextIfExists(
        resolveMeditationPath(relative)
      );
    }

    const messages = [
      {
        role: "system",
        content:
          aggregated ||
          "You are a writing assistant that helps create calm, mindful meditations."
      },
      {
        role: "user",
        content: [
          prompt.trim(),
          documentContent
            ? `\nCurrent document:\n${documentContent}`.trim()
            : null
        ]
          .filter(Boolean)
          .join("\n\n")
      }
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7
    });

    const message =
      completion.choices?.[0]?.message?.content ??
      "No response generated.";

    res.json({ message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate text";
    res.status(500).send(message);
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`PowerWriter server listening on http://localhost:${PORT}`);
});

