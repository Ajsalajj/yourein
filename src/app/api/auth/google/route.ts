import { NextResponse } from "next/server";
import { googleAuthUrl, googleConfigured, makeState } from "@/server/google";
import { originOf, safeNext } from "@/server/http";

export async function GET(req: Request) {
  const origin = originOf(req);
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  if (!googleConfigured()) return NextResponse.redirect(`${origin}/signin?error=google-off&next=${encodeURIComponent(next)}`);
  const state = makeState(next);
  const res = NextResponse.redirect(googleAuthUrl(origin, state));
  res.cookies.set("yi_oauth", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return res;
}
