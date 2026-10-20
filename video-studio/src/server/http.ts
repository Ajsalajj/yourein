import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { config } from "./config";

export class HttpError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
  }
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Access-token check + basic cross-site protection for state-changing calls. */
export function guard(req: NextRequest) {
  if (config.accessToken) {
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const supplied = bearer || req.headers.get("x-studio-token") || req.cookies.get("studio_token")?.value || req.nextUrl.searchParams.get("token") || "";
    if (!supplied || !safeEqual(supplied, config.accessToken)) throw new HttpError(401, "Missing or invalid access token");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const site = req.headers.get("sec-fetch-site");
    if (site && !["same-origin", "none"].includes(site)) throw new HttpError(403, "Cross-site requests are not allowed");
    const origin = req.headers.get("origin");
    if (origin) {
      const host = req.headers.get("host");
      try {
        if (new URL(origin).host !== host) throw new HttpError(403, "Cross-origin requests are not allowed");
      } catch (e) {
        if (e instanceof HttpError) throw e;
        throw new HttpError(403, "Bad origin");
      }
    }
  }
}

type Ctx<P> = { params: Promise<P> };
export function route<P = Record<string, string>>(handler: (req: NextRequest, params: P) => Promise<Response | NextResponse | object>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      guard(req);
      const out = await handler(req, await ctx.params);
      return out instanceof Response ? out : NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message, detail: e.detail }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: "Invalid data", detail: e.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
      console.error("[api]", req.method, req.nextUrl.pathname, e);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  };
}
