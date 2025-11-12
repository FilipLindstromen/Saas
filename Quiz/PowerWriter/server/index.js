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
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import OpenAI from "openai";

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
const DOCUMENT_META_SUFFIX = ".meta.json";

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
      completed: Boolean(meta?.completed)
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { completed: false };
    }
    throw error;
  }
}

async function writeDocumentMeta(documentAbsolutePath, meta) {
  const filePath = getDocumentMetaPath(documentAbsolutePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify(
      {
        completed: Boolean(meta?.completed)
      },
      null,
      2
    ),
    "utf8"
  );
}

async function renameIfExists(oldPath, newPath) {
  try {
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
      const colorPath = path.join(absolutePath, "_color.txt");
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
      await readTextIfExists(path.join(folderPath, "_color.txt"))
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
    await writeOptionalText(path.join(folderPath, "_color.txt"), color);
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

    const [content, instructions, aggregated, meta] = await Promise.all([
      readTextIfExists(documentPath),
      getDocumentInstructions(relative),
      gatherAggregatedInstructions(relative, "document"),
      readDocumentMeta(documentPath)
    ]);

    res.json({
      name: path.basename(documentPath),
      path: toPosix(relative),
      content,
      instructions,
      aggregatedInstructions: aggregated,
      completed: Boolean(meta.completed)
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
    await fs.rm(documentPath, { force: true });
    await fs.rm(`${documentPath}${INSTRUCTIONS_SUFFIX}`, { force: true });
    await fs.rm(getDocumentMetaPath(documentPath), { force: true });
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

