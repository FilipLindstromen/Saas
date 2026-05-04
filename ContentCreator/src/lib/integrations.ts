import { Integration } from "./types";

// Future integration facade for Airtable/Supabase/API providers.
// v1 intentionally stores keys only and does not execute live API calls.
export async function pingIntegration(integration: Integration) {
  void integration;
  return { ok: false, message: "Not connected in v1" };
}
