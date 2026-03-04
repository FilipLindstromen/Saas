/**
 * Simple in-memory cache for OpenAI responses
 * Reduces cost when regenerating with same params
 */

const cache = new Map<string, { data: unknown; expires: number }>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

export function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function cacheSet(key: string, data: unknown): void {
  cache.set(key, { data, expires: Date.now() + TTL_MS });
}

export function cacheKey(prefix: string, params: Record<string, unknown>): string {
  return `${prefix}:${JSON.stringify(params)}`;
}
