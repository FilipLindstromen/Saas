/**
 * Password reset via Resend (https://resend.com).
 * Set RESEND_API_KEY in the server environment. Use EMAIL_FROM with a domain you verified in Resend.
 */

import { Resend } from "resend";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.EMAIL_FROM?.trim() ||
    "BrainDump <onboarding@resend.dev>";

  if (!key) {
    console.warn(
      "[BrainDump] RESEND_API_KEY is not set — password reset emails are not sent. Add RESEND_API_KEY (and ideally EMAIL_FROM with your verified domain) to environment variables."
    );
    return { sent: false };
  }

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

  try {
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      subject: "Reset your BrainDump password",
      html,
      text,
    });

    if (error) {
      console.error("[BrainDump] Resend error:", error.name, error.message);
      return { sent: false, error: error.message };
    }

    if (!data?.id) {
      console.error("[BrainDump] Resend returned no message id", data);
      return { sent: false, error: "no_message_id" };
    }

    console.info("[BrainDump] Password reset email sent, id:", data.id);
    return { sent: true };
  } catch (e) {
    console.error("[BrainDump] Resend send exception:", e);
    return { sent: false, error: e instanceof Error ? e.message : "send_failed" };
  }
}
