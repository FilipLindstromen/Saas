import type {
  DocumentDetails,
  FolderDetails,
  TreeNode
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

