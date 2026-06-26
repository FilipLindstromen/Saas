import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@metaconnect.app";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${APP_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Reset your MetaConnect password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1e293b; margin-bottom: 8px;">Reset your password</h2>
        <p style="color: #64748b; margin-bottom: 24px;">
          Click the button below to reset your MetaConnect password. This link expires in 1 hour.
        </p>
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Reset Password
        </a>
        <p style="color:#94a3b8;font-size:13px;margin-top:24px;">
          If you didn't request this, you can ignore this email.
        </p>
      </div>
    `,
  });
}
