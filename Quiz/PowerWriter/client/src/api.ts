import type {
  DocumentDetails,
  FolderDetails,
  TreeNode,
  Transcription
} from "./types";

const baseHeaders = {
  "Content-Type": "application/json"
};

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
  const response = await fetch("/api/tree");
  return handleResponse<TreeNode[]>(response);
}

export async function getFolderDetails(
  path: string
): Promise<FolderDetails> {
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
  const response = await fetch("/api/document/create", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ folderPath, name })
  });
  return handleResponse<{ success: true; path: string }>(response);
}

export async function renameFolder(path: string, newName: string) {
  const response = await fetch("/api/folder/rename", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ path, newName })
  });
  return handleResponse<{ success: true; path: string }>(response);
}

export async function renameDocument(path: string, newName: string) {
  const response = await fetch("/api/document/rename", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ path, newName })
  });
  return handleResponse<{ success: true; path: string }>(response);
}

export async function deleteFolder(path: string) {
  const response = await fetch("/api/folder/delete", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ path })
  });
  return handleResponse<{ success: true }>(response);
}

export async function deleteDocument(path: string) {
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

export async function generateAnswer(params: {
  path: string | null;
  prompt: string;
  apiKey?: string;
}): Promise<{ message: string }> {
  const response = await fetch("/api/generate", {
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
  return handleResponse<{ message: string }>(response);
}

export async function generateVariants(params: {
  path: string | null;
  text: string;
  mode: "simplify" | "expand" | "rephrase";
  apiKey?: string;
}): Promise<{ variants: string[] }> {
  const response = await fetch("/api/generate-variants", {
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
  return handleResponse<{ variants: string[] }>(response);
}

export async function uploadDocumentAudio(
  path: string,
  file: Blob
): Promise<{ audioUrl: string; audioFileName: string }> {
  const formData = new FormData();
  formData.append("path", path);
  const extension =
    file.type === "audio/mpeg"
      ? "mp3"
      : file.type === "audio/wav"
      ? "wav"
      : file.type === "audio/ogg"
      ? "ogg"
      : file.type === "audio/mp4"
      ? "m4a"
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
  }>(response);
  return { audioUrl: result.audioUrl, audioFileName: result.audioFileName };
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

