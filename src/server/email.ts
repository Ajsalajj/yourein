import { SITE_NAME } from "@/config/site";

export const emailConfigured = () => !!process.env.RESEND_API_KEY;

/**
 * Sends through Resend when RESEND_API_KEY is set. Without it nothing is sent;
 * the message is written to the server log so local development still works.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[yourein] email not configured. Would send to ${to}: ${subject}\n${text}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || `${SITE_NAME} <onboarding@resend.dev>`, to, subject, text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.error("[yourein] email failed:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("[yourein] email could not be sent:", (e as Error).message);
    return false;
  }
}
