import { SITE_NAME } from "@/config/site";
import { startPasswordReset } from "@/server/auth";
import { emailConfigured, sendEmail } from "@/server/email";
import { body, clientIp, ok, originOf, rateLimit, route } from "@/server/http";

export const POST = route(async (req) => {
  rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60_000);
  const b = await body(req);
  const reset = await startPasswordReset(b.email);
  const link = reset ? `${originOf(req)}/reset?token=${reset.token}` : null;

  if (!emailConfigured()) {
    /* Email is not set up. In development, hand the link back so the flow can be tried. */
    if (process.env.NODE_ENV !== "production") return ok({ sent: false, devLink: link });
    return ok({ sent: false, unavailable: true });
  }
  if (reset && link) {
    await sendEmail(
      reset.email,
      `Reset your ${SITE_NAME} password`,
      `Hello${reset.name ? ` ${reset.name}` : ""},\n\nUse this link to choose a new password. It works for one hour.\n\n${link}\n\nIf you did not ask for this, you can ignore this email.\n\n${SITE_NAME}`,
    );
  }
  /* Same answer whether or not the account exists. */
  return ok({ sent: true });
});
