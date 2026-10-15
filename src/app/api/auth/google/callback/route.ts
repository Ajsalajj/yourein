import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession, googleUser } from "@/server/auth";
import { googleConfigured, googleProfile, readState } from "@/server/google";
import { originOf, safeNext } from "@/server/http";
import { currentVisit, trackRegistration } from "@/server/meta/events";

export async function GET(req: Request) {
  const origin = originOf(req);
  const url = new URL(req.url);
  const jar = await cookies();
  const next = readState(url.searchParams.get("state"), jar.get("yi_oauth")?.value);
  jar.delete("yi_oauth");
  const fail = (code: string) => NextResponse.redirect(`${origin}/signin?error=${code}${next ? `&next=${encodeURIComponent(safeNext(next))}` : ""}`);

  if (!googleConfigured()) return fail("google-off");
  const code = url.searchParams.get("code");
  if (!next || !code) return fail("google-failed");
  try {
    const profile = await googleProfile(origin, code);
    if (!profile) return fail("google-failed");
    const user = await googleUser(profile.sub, profile.email, profile.name);
    await createSession(user.id);
    /* a new account made through Google: server-side only, as the browser is mid-redirect */
    if (user.created) trackRegistration(user, await currentVisit());
    return NextResponse.redirect(`${origin}${safeNext(next)}`);
  } catch (e) {
    console.error("[yourein] Google sign-in failed:", e);
    return fail("google-failed");
  }
}
