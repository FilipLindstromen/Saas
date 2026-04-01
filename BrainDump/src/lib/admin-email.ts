/**
 * Admin dashboard access: signed-in users whose email appears in ADMIN_EMAILS (comma or semicolon separated).
 * Use your normal BrainDump account; protect it with a strong password and ideally Google 2FA on that Google account.
 */
export function parseAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(/[,;]/g)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = parseAdminEmails();
  if (list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}
