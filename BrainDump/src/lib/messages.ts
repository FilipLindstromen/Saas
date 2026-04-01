/**
 * UI strings: edit copy in `locales/en.json` and `locales/sv.json`.
 * To regenerate JSON from an old TS blob, run: `node scripts/extract-messages-to-json.mjs`
 */

import en from "./locales/en.json";
import sv from "./locales/sv.json";

export type Locale = "en" | "sv";

export const BRAINDUMP_LOCALE_KEY = "braindump-locale";

type Msg = Record<string, string>;

export const messages: Record<Locale, Msg> = {
  en: en as Msg,
  sv: sv as Msg,
};

export function interpolate(template: string, vars: Record<string, string | number>): string {
  let s = template;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return s;
}
