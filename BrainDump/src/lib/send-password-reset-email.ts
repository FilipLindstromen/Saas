/**
 * Optional Resend integration. Set RESEND_API_KEY and EMAIL_FROM in production.
 * If not configured, forgot-password still creates a token (logged on server in dev).
 */

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "BrainDump <onboarding@resend.dev>";

  if (!key) {
    console.warn(
      "[BrainDump] RESEND_API_KEY not set — password reset email not sent. Configure Resend or copy the link from server logs in development."
    );
    return { sent: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Reset your BrainDump password",
        html: `
          <p>You asked to reset your BrainDump password.</p>
          <p><a href="${resetUrl}" style="color:#ea580c;font-weight:600;">Reset password</a></p>
          <p style="color:#666;font-size:14px;">This link expires in 1 hour. If you didn’t request this, you can ignore this email.</p>
        `.trim(),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[BrainDump] Resend error:", res.status, text);
      return { sent: false, error: "email_failed" };
    }
    return { sent: true };
  } catch (e) {
    console.error("[BrainDump] Resend fetch failed:", e);
    return { sent: false, error: "email_failed" };
  }
}
