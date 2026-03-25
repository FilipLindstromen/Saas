/** fetch with AbortController timeout (FormData POSTs, etc.). */

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out. Try again.");
    }
    throw e;
  } finally {
    clearTimeout(tid);
  }
}

/** JSON POST with timeout and safe body parsing (handles long / odd responses). */

export async function postJsonWithTimeout<T>(
  url: string,
  body: unknown,
  timeoutMs: number,
  init?: Omit<RequestInit, "body" | "method" | "headers" | "signal">
): Promise<{ ok: boolean; status: number; data: T }> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      ...init,
    });
    const text = await res.text();
    let data: T;
    try {
      data = (text.trim() ? JSON.parse(text) : {}) as T;
    } catch {
      if (!res.ok) {
        throw new Error(text.trim().slice(0, 280) || `Request failed (${res.status})`);
      }
      throw new Error("Invalid JSON from server");
    }
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out. Try again or shorten the transcript.");
    }
    throw e;
  } finally {
    clearTimeout(tid);
  }
}
