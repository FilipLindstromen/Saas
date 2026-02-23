import OpenAI from "openai";
import type {
  DocumentDetails,
  FolderDetails,
  TreeNode,
  Transcription
} from "./types";
import { loadApiKeys } from "./apiKeys";
import {
  isApiAvailable,
  storageCreateDocument,
  storageCreateFolder,
  storageDeleteDocument,
  storageDeleteFolder,
  storageFetchTree,
  storageGetDocumentDetails,
  storageGetFolderDetails,
  storageRenameDocument,
  storageRenameFolder,
  storageSaveDocument,
  storageSaveDocumentTranscription,
  storageSaveFolderInstructions
} from "./storage";

const VARIANT_MODE_INSTRUCTIONS: Record<string, string> = {
  simplify:
    "Simplify the text while preserving its meaning, tone, and key details. Make it easier to read without losing important information.",
  expand:
    "Expand the text with additional sensory detail and context while keeping the original voice and intent. Avoid repeating sentences verbatim.",
  rephrase:
    "Rephrase the text using different wording while keeping the same meaning, tone, and approximate length."
};

const baseHeaders = {
  "Content-Type": "application/json"
};

let useStorage: boolean | null = null;

async function shouldUseStorage(): Promise<boolean> {
  if (useStorage !== null) return useStorage;
  useStorage = !(await isApiAvailable());
  return useStorage;
}

function buildHeaders(additional?: Record<string, string>) {
  return additional
    ? {
        ...baseHeaders,
        ...additional
      }
    : baseHeaders;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  return (await response.json()) as T;
}

export async function fetchTree(): Promise<TreeNode[]> {
  if (await shouldUseStorage()) {
    return storageFetchTree();
  }
  const response = await fetch("/api/tree");
  return handleResponse<TreeNode[]>(response);
}

export async function getFolderDetails(
  path: string
): Promise<FolderDetails> {
  if (await shouldUseStorage()) {
    return storageGetFolderDetails(path);
  }
  const response = await fetch(
    `/api/folder?path=${encodeURIComponent(path)}`
  );
  return handleResponse<FolderDetails>(response);
}

export async function saveFolderInstructions(
  path: string,
  instructions: string,
  color?: string
) {
  if (await shouldUseStorage()) {
    storageSaveFolderInstructions(path, instructions, color);
    return { success: true as const };
  }
  const response = await fetch("/api/folder", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ path, instructions, color })
  });
  return handleResponse<{ success: true }>(response);
}

export async function createFolder(
  parentPath: string | null,
  name: string
) {
  if (await shouldUseStorage()) {
    return storageCreateFolder(parentPath, name);
  }
  const response = await fetch("/api/folder/create", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ parentPath, name })
  });
  return handleResponse<{ success: true; path: string }>(response);
}

export async function getDocumentDetails(
  path: string
): Promise<DocumentDetails> {
  if (await shouldUseStorage()) {
    return storageGetDocumentDetails(path);
  }
  const response = await fetch(
    `/api/document?path=${encodeURIComponent(path)}`
  );
  return handleResponse<DocumentDetails>(response);
}

export async function saveDocument(
  path: string,
  content: string,
  instructions: string,
  options?: { completed?: boolean }
) {
  if (await shouldUseStorage()) {
    storageSaveDocument(path, content, instructions, options);
    return { success: true as const };
  }
  const response = await fetch("/api/document", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      path,
      content,
      instructions,
      completed: options?.completed
    })
  });
  return handleResponse<{ success: true }>(response);
}

export async function createDocument(
  folderPath: string | null,
  name: string
) {
  if (await shouldUseStorage()) {
    return storageCreateDocument(folderPath, name);
  }
  const response = await fetch("/api/document/create", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ folderPath, name })
  });
  return handleResponse<{ success: true; path: string }>(response);
}

export async function renameFolder(path: string, newName: string) {
  if (await shouldUseStorage()) {
    return storageRenameFolder(path, newName);
  }
  const response = await fetch("/api/folder/rename", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ path, newName })
  });
  return handleResponse<{ success: true; path: string }>(response);
}

export async function renameDocument(path: string, newName: string) {
  if (await shouldUseStorage()) {
    return storageRenameDocument(path, newName);
  }
  const response = await fetch("/api/document/rename", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ path, newName })
  });
  return handleResponse<{ success: true; path: string }>(response);
}

export async function deleteFolder(path: string) {
  if (await shouldUseStorage()) {
    storageDeleteFolder(path);
    return { success: true as const };
  }
  const response = await fetch("/api/folder/delete", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ path })
  });
  return handleResponse<{ success: true }>(response);
}

export async function deleteDocument(path: string) {
  if (await shouldUseStorage()) {
    storageDeleteDocument(path);
    return { success: true as const };
  }
  const response = await fetch("/api/document/delete", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ path })
  });
  return handleResponse<{ success: true }>(response);
}

export async function moveFolder(path: string, targetParentPath: string | null) {
  const response = await fetch("/api/folder/move", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ path, targetParentPath })
  });
  return handleResponse<{ success: true; path: string }>(response);
}

export async function moveDocument(
  path: string,
  targetFolderPath: string | null
) {
  const response = await fetch("/api/document/move", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ path, targetFolderPath })
  });
  return handleResponse<{ success: true; path: string }>(response);
}

export async function reorderItem(
  path: string,
  direction: "up" | "down"
) {
  const response = await fetch("/api/order", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ path, direction })
  });
  return handleResponse<{ success: true }>(response);
}

function isApiUnavailableError(response: Response | null, err: unknown): boolean {
  if (response) {
    return response.status === 404 || response.status === 405;
  }
  return err instanceof TypeError && (err.message === "Failed to fetch" || err.message.includes("NetworkError"));
}

export async function generateAnswer(params: {
  path: string | null;
  prompt: string;
  apiKey?: string;
}): Promise<{ message: string }> {
  let response: Response | null = null;
  try {
    response = await fetch("/api/generate", {
      method: "POST",
      headers: buildHeaders(
        params.apiKey
          ? {
              "x-openai-key": params.apiKey
            }
          : undefined
      ),
      body: JSON.stringify({
        path: params.path,
        prompt: params.prompt
      })
    });
    if (!isApiUnavailableError(response, null)) {
      return handleResponse<{ message: string }>(response);
    }
  } catch (err) {
    if (!isApiUnavailableError(null, err)) {
      throw err;
    }
  }

  const apiKey = params.apiKey || loadApiKeys().openai;
  if (!apiKey?.trim()) {
    throw new Error(
      "OpenAI API key is not configured. Add one in settings or run the server with OPENAI_API_KEY."
    );
  }

  const pathString = typeof params.path === "string" ? params.path : "";
  let aggregated = "";
  let documentContent = "";
  if (pathString) {
    if (pathString.endsWith(".txt")) {
      const doc = storageGetDocumentDetails(pathString);
      aggregated = doc.aggregatedInstructions || "";
      documentContent = doc.content || "";
    } else {
      const folder = storageGetFolderDetails(pathString);
      aggregated = folder.aggregatedInstructions || "";
    }
  }

  const openai = new OpenAI({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true });
  const systemContent =
    aggregated ||
    "You are a writing assistant that helps create calm, mindful meditations.";
  const userContent = [
    params.prompt.trim(),
    documentContent ? `\nCurrent document:\n${documentContent}`.trim() : null
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent }
    ],
    temperature: 0.7
  });

  const message =
    completion.choices?.[0]?.message?.content ?? "No response generated.";
  return { message };
}

export async function generateVariants(params: {
  path: string | null;
  text: string;
  mode: "simplify" | "expand" | "rephrase";
  apiKey?: string;
}): Promise<{ variants: string[] }> {
  let response: Response | null = null;
  try {
    response = await fetch("/api/generate-variants", {
      method: "POST",
      headers: buildHeaders(
        params.apiKey
          ? {
              "x-openai-key": params.apiKey
            }
          : undefined
      ),
      body: JSON.stringify({
        path: params.path,
        text: params.text,
        mode: params.mode
      })
    });
    if (!isApiUnavailableError(response, null)) {
      return handleResponse<{ variants: string[] }>(response);
    }
  } catch (err) {
    if (!isApiUnavailableError(null, err)) {
      throw err;
    }
  }

  const apiKey = params.apiKey || loadApiKeys().openai;
  if (!apiKey?.trim()) {
    throw new Error(
      "OpenAI API key is not configured. Add one in settings or run the server with OPENAI_API_KEY."
    );
  }

  const taskInstruction = VARIANT_MODE_INSTRUCTIONS[params.mode];
  if (!taskInstruction) {
    throw new Error("Invalid mode. Use: simplify, expand, rephrase.");
  }

  const pathString = typeof params.path === "string" ? params.path : "";
  let aggregated = "";
  if (pathString) {
    if (pathString.endsWith(".txt")) {
      const doc = storageGetDocumentDetails(pathString);
      aggregated = doc.aggregatedInstructions || "";
    } else {
      const folder = storageGetFolderDetails(pathString);
      aggregated = folder.aggregatedInstructions || "";
    }
  }

  const systemPrompt =
    aggregated ||
    "You are a helpful writing assistant that rewrites user-provided passages.";
  const userPrompt = [
    `Task: ${taskInstruction}`,
    "Original text:",
    params.text.trim(),
    "",
    "Provide exactly three distinct variations that satisfy the task.",
    "Respond strictly as JSON in the format:",
    '["Variant 1", "Variant 2", "Variant 3"]',
    "Do not include any additional commentary."
  ].join("\n");

  const openai = new OpenAI({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.7
  });

  const rawContent =
    completion.choices?.[0]?.message?.content?.trim() ?? "[]";
  let variants: string[];
  try {
    const parsed = JSON.parse(rawContent);
    if (!Array.isArray(parsed)) {
      throw new Error("Expected JSON array");
    }
    variants = parsed
      .filter((v: unknown) => typeof v === "string")
      .slice(0, 3);
  } catch {
    throw new Error(
      `Unable to parse response from OpenAI. Received: ${rawContent.slice(0, 200)}`
    );
  }
  return { variants };
}

export async function uploadDocumentAudio(
  path: string,
  file: Blob,
  append: boolean = true
): Promise<{ audioUrl: string; audioFileName: string; recordingId?: string; recording?: any }> {
  const formData = new FormData();
  formData.append("path", path);
  formData.append("append", String(append));
  const extension =
    file.type === "audio/mpeg"
      ? "mp3"
      : file.type === "audio/wav"
      ? "wav"
      : file.type === "audio/ogg"
      ? "ogg"
      : file.type === "audio/mp4"
      ? "m4a"
      : file.type.startsWith("video/")
      ? "webm"
      : "webm";
  formData.append("audio", file, `recording.${extension}`);
  const response = await fetch("/api/document/audio", {
    method: "POST",
    body: formData
  });
  const result = await handleResponse<{
    success: true;
    audioUrl: string;
    audioFileName: string;
    recordingId?: string;
    recording?: any;
  }>(response);
  return { 
    audioUrl: result.audioUrl, 
    audioFileName: result.audioFileName,
    recordingId: result.recordingId,
    recording: result.recording
  };
}

export async function saveDocumentTranscription(
  path: string,
  transcription: Transcription
): Promise<{ success: true }> {
  if (await shouldUseStorage()) {
    storageSaveDocumentTranscription(path, transcription);
    return { success: true as const };
  }
  const response = await fetch("/api/document/transcription", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ path, transcription })
  });
  return handleResponse<{ success: true }>(response);
}

export async function transcribeDocumentAudio(
  path: string,
  apiKey?: string
): Promise<{ transcription: Transcription }> {
  const response = await fetch("/api/document/transcribe", {
    method: "POST",
    headers: buildHeaders(
      apiKey
        ? {
            "x-openai-key": apiKey
          }
        : undefined
    ),
    body: JSON.stringify({ path })
  });
  return handleResponse<{ success: true; transcription: Transcription }>(
    response
  );
}

export async function editDocumentAudio(
  path: string,
  segments: Array<{ start: number; end: number }>
): Promise<{ audioUrl: string }> {
  const response = await fetch("/api/document/audio/edit", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ path, segments })
  });
  return handleResponse<{ success: true; audioUrl: string }>(response);
}

export async function enhanceDocumentAudio(
  path: string
): Promise<{ audioUrl: string }> {
  const response = await fetch("/api/document/audio/enhance", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ path })
  });
  return handleResponse<{ success: true; audioUrl: string }>(response);
}

export async function exportAudioAsMp3(path: string): Promise<void> {
  const response = await fetch(
    `/api/document/audio/export-mp3?path=${encodeURIComponent(path)}`
  );
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Failed to export audio" }));
    throw new Error(errorData.message || errorData.error || "Failed to export audio as MP3");
  }

  // Get filename from Content-Disposition header or generate one
  const contentDisposition = response.headers.get("Content-Disposition");
  let fileName = "audio.mp3";
  if (contentDisposition) {
    const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
    if (fileNameMatch) {
      fileName = fileNameMatch[1];
    }
  }

  // Download the file
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function renameItem(sourcePath: string, targetPath: string) {
  const response = await fetch("/api/rename", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ sourcePath, targetPath })
  });
  return handleResponse<{ success: true }>(response);
}

export async function moveItem(sourcePath: string, destinationFolder: string) {
  const response = await fetch("/api/move", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ sourcePath, destinationFolder })
  });
  return handleResponse<{ success: true; path: string }>(response);
}

export async function deleteItem(path: string) {
  const response = await fetch("/api/delete", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ path })
  });
  return handleResponse<{ success: true }>(response);
}

