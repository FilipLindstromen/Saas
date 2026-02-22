/**
 * localStorage-based storage for PowerWriter.
 * Used when deployed on static hosting (e.g. GitHub Pages) where the API is unavailable.
 * Mirrors the API interface so the app works the same as InfoGraphics.
 */

import type {
  DocumentDetails,
  FolderDetails,
  TreeNode,
  Transcription
} from "./types";

const TREE_KEY = "powerwriter_tree";
const FOLDER_PREFIX = "powerwriter_folder::";
const DOCUMENT_PREFIX = "powerwriter_document::";

function pathKey(path: string): string {
  return path.replace(/\//g, "::");
}

function getFolderKey(path: string): string {
  return FOLDER_PREFIX + pathKey(path);
}

function getDocumentKey(path: string): string {
  return DOCUMENT_PREFIX + pathKey(path);
}

function getParentPath(path: string): string | null {
  const idx = path.lastIndexOf("/");
  if (idx <= 0) return null;
  return path.slice(0, idx);
}

function getAggregatedInstructions(
  path: string,
  type: "folder" | "document",
  getFolder: (p: string) => { instructions: string } | null,
  getDocument: (p: string) => { instructions: string } | null
): string {
  const parts: string[] = [];
  let current: string | null = path;
  while (current) {
    const parent = getParentPath(current);
    if (parent) {
      const folder = getFolder(parent);
      if (folder?.instructions?.trim()) {
        parts.unshift(folder.instructions.trim());
      }
    }
    current = parent;
  }
  if (type === "document") {
    const doc = getDocument(path);
    if (doc?.instructions?.trim()) {
      parts.push(doc.instructions.trim());
    }
  }
  return parts.filter(Boolean).join("\n\n");
}

function loadTree(): TreeNode[] {
  try {
    const raw = localStorage.getItem(TREE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // ignore
  }
  return [];
}

function saveTree(tree: TreeNode[]): void {
  localStorage.setItem(TREE_KEY, JSON.stringify(tree));
}

function findInTree(tree: TreeNode[], path: string): TreeNode | null {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  let current: TreeNode[] = tree;
  let found: TreeNode | null = null;
  for (let i = 0; i < segments.length; i++) {
    const name = segments[i];
    const node = current.find((n) => n.name === name);
    if (!node) return null;
    found = node;
    if (i < segments.length - 1) {
      if (node.type !== "folder" || !node.children) return null;
      current = node.children;
    }
  }
  return found;
}

function findParentChildren(tree: TreeNode[], path: string): { parent: TreeNode[]; name: string } | null {
  if (!path) {
    return { parent: tree, name: "" };
  }
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return { parent: tree, name: "" };
  let current: TreeNode[] = tree;
  for (let i = 0; i < segments.length; i++) {
    const name = segments[i]!;
    const node = current.find((n) => n.name === name);
    if (!node) return null;
    if (i === segments.length - 1) {
      return {
        parent: node.type === "folder" ? (node.children ??= []) : current,
        name
      };
    }
    if (node.type !== "folder") return null;
    current = node.children ??= [];
  }
  return { parent: current, name: segments[segments.length - 1]! };
}

function addToTree(tree: TreeNode[], parentPath: string | null, name: string, type: "folder" | "document"): string {
  const parent = parentPath ?? "";
  const { parent: parentArr } = findParentChildren(tree, parent) ?? { parent: tree, name: "" };
  if (!parentArr) throw new Error("Parent not found");
  const path = parent ? `${parent}/${name}` : name;
  const existing = parentArr.find((n) => n.name === name);
  if (existing) throw new Error("Item already exists");
  const node: TreeNode =
    type === "folder"
      ? { type: "folder", name, path, children: [] }
      : { type: "document", name, path };
  parentArr.push(node);
  saveTree(tree);
  return path;
}

function removeFromTree(tree: TreeNode[], path: string): void {
  const { parent, name } = findParentChildren(tree, getParentPath(path) ?? "") ?? { parent: tree, name: "" };
  if (!parent) return;
  const idx = parent.findIndex((n) => n.path === path);
  if (idx >= 0) {
    parent.splice(idx, 1);
    saveTree(tree);
  }
}

function updateDescendantPaths(node: TreeNode, newBasePath: string): void {
  if (node.type === "folder" && node.children) {
    for (const child of node.children) {
      child.path = `${newBasePath}/${child.name}`;
      updateDescendantPaths(child, child.path);
    }
  }
}

function renameInTree(tree: TreeNode[], path: string, newName: string): string {
  const node = findInTree(tree, path);
  if (!node) throw new Error("Not found");
  const parentPath = getParentPath(path);
  const newPath = parentPath ? `${parentPath}/${newName}` : newName;
  node.name = newName;
  node.path = newPath;
  if (node.type === "folder" && node.children) {
    updateDescendantPaths(node, newPath);
  }
  saveTree(tree);
  return newPath;
}

// --- Public API (matches api.ts) ---

export function storageFetchTree(): TreeNode[] {
  return loadTree();
}

export function storageGetFolderDetails(path: string): FolderDetails {
  const raw = localStorage.getItem(getFolderKey(path));
  const data = raw ? JSON.parse(raw) : {};
  const instructions = (data.instructions ?? "").trim();
  const color = data.color ?? null;
  const name = path.split("/").filter(Boolean).pop() ?? path;
  const getFolder = (p: string) => {
    const r = localStorage.getItem(getFolderKey(p));
    return r ? JSON.parse(r) : null;
  };
  const aggregated = getAggregatedInstructions(path, "folder", getFolder, () => null);
  return {
    path,
    name,
    instructions,
    aggregatedInstructions: aggregated,
    color
  };
}

export function storageSaveFolderInstructions(path: string, instructions: string, color?: string): void {
  const key = getFolderKey(path);
  const existing = localStorage.getItem(key);
  const data = existing ? JSON.parse(existing) : {};
  data.instructions = instructions ?? "";
  if (color !== undefined) data.color = color || null;
  localStorage.setItem(key, JSON.stringify(data));
}

export function storageCreateFolder(parentPath: string | null, name: string): { path: string } {
  const tree = loadTree();
  const path = addToTree(tree, parentPath, name, "folder");
  return { path };
}

export function storageGetDocumentDetails(path: string): DocumentDetails {
  const raw = localStorage.getItem(getDocumentKey(path));
  const data = raw ? JSON.parse(raw) : {};
  const content = data.content ?? "";
  const instructions = (data.instructions ?? "").trim();
  const completed = Boolean(data.completed);
  const recordings = Array.isArray(data.recordings) ? data.recordings : [];
  const transcription: Transcription | null = data.transcription ?? null;
  const name = path.split("/").filter(Boolean).pop() ?? path;
  const getFolder = (p: string) => {
    const r = localStorage.getItem(getFolderKey(p));
    return r ? JSON.parse(r) : null;
  };
  const getDocument = (p: string) => {
    const r = localStorage.getItem(getDocumentKey(p));
    return r ? JSON.parse(r) : null;
  };
  const aggregated = getAggregatedInstructions(path, "document", getFolder, getDocument);
  return {
    path,
    name,
    content,
    instructions,
    aggregatedInstructions: aggregated,
    completed,
    audioUrl: null,
    audioFileName: null,
    recordings: recordings.length > 0 ? recordings : undefined,
    transcription
  };
}

export function storageSaveDocument(
  path: string,
  content: string,
  instructions: string,
  options?: { completed?: boolean }
): void {
  const key = getDocumentKey(path);
  const existing = localStorage.getItem(key);
  const data = existing ? JSON.parse(existing) : {};
  data.content = content ?? "";
  data.instructions = instructions ?? "";
  if (options?.completed !== undefined) data.completed = options.completed;
  localStorage.setItem(key, JSON.stringify(data));
}

export function storageCreateDocument(folderPath: string | null, name: string): { path: string } {
  const baseName = name.endsWith(".txt") ? name : `${name}.txt`;
  const tree = loadTree();
  const path = addToTree(tree, folderPath, baseName, "document");
  const key = getDocumentKey(path);
  localStorage.setItem(
    key,
    JSON.stringify({
      content: "",
      instructions: "",
      completed: false,
      recordings: [],
      transcription: null
    })
  );
  return { path };
}

function migrateStorageKeysForRename(oldBase: string, newBase: string, node: TreeNode): void {
  if (node.type === "folder") {
    const oldKey = getFolderKey(oldBase);
    const newKey = getFolderKey(newBase);
    const raw = localStorage.getItem(oldKey);
    if (raw) {
      localStorage.setItem(newKey, raw);
      localStorage.removeItem(oldKey);
    }
    if (node.children) {
      for (const child of node.children) {
        migrateStorageKeysForRename(
          `${oldBase}/${child.name}`,
          `${newBase}/${child.name}`,
          child
        );
      }
    }
  } else {
    const oldKey = getDocumentKey(oldBase);
    const newKey = getDocumentKey(newBase);
    const raw = localStorage.getItem(oldKey);
    if (raw) {
      localStorage.setItem(newKey, raw);
      localStorage.removeItem(oldKey);
    }
  }
}

export function storageRenameFolder(path: string, newName: string): { path: string } {
  const tree = loadTree();
  const node = findInTree(tree, path);
  if (!node) throw new Error("Folder not found");
  const newPath = renameInTree(tree, path, newName);
  migrateStorageKeysForRename(path, newPath, node);
  return { path: newPath };
}

export function storageRenameDocument(path: string, newName: string): { path: string } {
  const tree = loadTree();
  const node = findInTree(tree, path);
  if (!node) throw new Error("Document not found");
  const newPath = renameInTree(tree, path, newName);
  const oldKey = getDocumentKey(path);
  const newKey = getDocumentKey(newPath);
  const raw = localStorage.getItem(oldKey);
  if (raw) {
    localStorage.setItem(newKey, raw);
    localStorage.removeItem(oldKey);
  }
  return { path: newPath };
}

export function storageDeleteFolder(path: string): void {
  const tree = loadTree();
  const node = findInTree(tree, path);
  if (node?.type === "folder" && node.children) {
    for (const child of node.children) {
      if (child.type === "folder") {
        storageDeleteFolder(child.path);
      } else {
        storageDeleteDocument(child.path);
      }
    }
  }
  removeFromTree(tree, path);
  localStorage.removeItem(getFolderKey(path));
}

export function storageDeleteDocument(path: string): void {
  const tree = loadTree();
  removeFromTree(tree, path);
  localStorage.removeItem(getDocumentKey(path));
}

export function storageSaveDocumentTranscription(path: string, transcription: Transcription): void {
  const key = getDocumentKey(path);
  const existing = localStorage.getItem(key);
  const data = existing ? JSON.parse(existing) : {};
  data.transcription = transcription;
  localStorage.setItem(key, JSON.stringify(data));
}

/** Check if we're on static hosting (no API). Use storage in that case. */
export async function isApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/tree", { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}
