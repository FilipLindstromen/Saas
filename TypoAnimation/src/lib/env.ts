import path from 'path';
import { readFileSync } from 'fs';

// This app lives inside the Saas monorepo (Saas/TypoAnimation) alongside sibling apps that
// already have Pexels/Pixabay/OpenAI keys configured in the monorepo root's .env (see
// Saas/shared/apiKeys.js for the client-side equivalent). Rather than asking for a second
// copy of the same keys, fall back to reading them from there — this app's own .env.local
// still wins if set, so nothing here is a hidden requirement.
let parentEnvCache: Record<string, string> | null = null;

function loadParentEnv(): Record<string, string> {
  if (parentEnvCache) return parentEnvCache;
  parentEnvCache = {};
  try {
    const raw = readFileSync(path.join(process.cwd(), '..', '.env'), 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key) parentEnvCache[key] = value;
    }
  } catch {
    // no parent .env — fine, keys just won't resolve from there
  }
  return parentEnvCache;
}

// Looks up an API key: this app's own process.env first, then the monorepo root .env.
export function getSharedApiKey(name: string): string | undefined {
  const own = process.env[name];
  if (own && own.trim()) return own.trim();
  const parent = loadParentEnv()[name];
  return parent && parent.trim() ? parent.trim() : undefined;
}
