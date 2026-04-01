/**
 * Password reset email: Resend (preferred) or SMTP fallback.
 *
 * Resend: RESEND_API_KEY; recommend EMAIL_FROM with a verified domain.
 * SMTP: SMTP_URL *or* SMTP_HOST + SMTP_USER + SMTP_PASSWORD (or SMTP_PASS);
 *       EMAIL_FROM required for SMTP (e.g. "BrainDump <noreply@yourdomain.com>").
 */

import { Resend } from "resend";
import nodemailer from "nodemailer";

function hasResend(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function hasSmtp(): boolean {
  if (process.env.SMTP_URL?.trim()) return true;
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim() || process.env.SMTP_PASS?.trim();
  return Boolean(host && user && pass);
}

/** True if delivery can be attempted (Resend key, or SMTP + EMAIL_FROM). */
export function isEmailDeliveryConfigured(): boolean {
  if (hasResend()) return true;
  if (hasSmtp()) return Boolean(process.env.EMAIL_FROM?.trim());
  return false;
}

async function sendViaSmtp(
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<{ sent: boolean; error?: string }> {
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) {
    console.warn("[BrainDump] SMTP is configured but EMAIL_FROM is missing — cannot send.");
    return { sent: false, error: "email_from_required" };
  }

  try {
    const url = process.env.SMTP_URL?.trim();
    const host = process.env.SMTP_HOST?.trim();
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASSWORD?.trim() || process.env.SMTP_PASS?.trim();

    const transport = url
      ? nodemailer.createTransport(url)
      : host && smtpUser && smtpPass
        ? nodemailer.createTransport({
            host,
            port: Number(process.env.SMTP_PORT ?? 587),
            secure:
              process.env.SMTP_SECURE === "true" ||
              Number(process.env.SMTP_PORT ?? 587) === 465,
            auth: { user: smtpUser, pass: smtpPass },
          })
        : null;

    if (!transport) {
      return { sent: false, error: "smtp_misconfigured" };
    }

    await transport.sendMail({ from, to, subject, text, html });
    console.info("[BrainDump] Password reset email sent via SMTP.");
    return { sent: true };
  } catch (e) {
    console.error("[BrainDump] SMTP send exception:", e);
    return { sent: false, error: e instanceof Error ? e.message : "smtp_failed" };
  }
}

async function sendViaResend(
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY!.trim();
  const fromRaw = process.env.EMAIL_FROM?.trim();
  const from = fromRaw || "BrainDump <onboarding@resend.dev>";

  if (!fromRaw) {
    console.warn(
      "[BrainDump] EMAIL_FROM is not set — using onboarding@resend.dev. For production, verify your domain in Resend and set EMAIL_FROM."
    );
  }

  try {
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      subject,
      html,
      text,
      tags: [{ name: "category", value: "password-reset" }],
    });

    if (error) {
      console.error("[BrainDump] Resend error:", error.name, error.message);
      return { sent: false, error: error.message };
    }

    if (!data?.id) {
      console.error("[BrainDump] Resend returned no message id", data);
      return { sent: false, error: "no_message_id" };
    }

    console.info("[BrainDump] Password reset email sent via Resend, id:", data.id);
    return { sent: true };
  } catch (e) {
    console.error("[BrainDump] Resend send exception:", e);
    return { sent: false, error: e instanceof Error ? e.message : "send_failed" };
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<{ sent: boolean; error?: string }> {
  const subject = "Reset your BrainDump password";

  const text = [
    "You asked to reset your BrainDump password.",
    "",
    `Reset password: ${resetUrl}`,
    "",
    "This link expires in 1 hour. If you did not request this, you can ignore this email.",
  ].join("\n");

  const html = `
    <p>You asked to reset your BrainDump password.</p>
    <p><a href="${resetUrl}" style="color:#ea580c;font-weight:600;">Reset password</a></p>
    <p style="color:#666;font-size:14px;">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
  `.trim();

  if (hasResend()) {
    return sendViaResend(to, subject, text, html);
  }

  if (hasSmtp()) {
    return sendViaSmtp(to, subject, text, html);
  }

  console.warn(
    "[BrainDump] No mail transport: set RESEND_API_KEY or SMTP (SMTP_URL or SMTP_HOST + SMTP_USER + SMTP_PASSWORD) and EMAIL_FROM."
  );
  return { sent: false };
}
