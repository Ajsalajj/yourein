import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { flushOutbox } from "@/server/meta/events";

/**
 * Retries Purchase events Meta did not accept the first time. Vercel Cron calls it (see vercel.json) with
 * "Authorization: Bearer <CRON_SECRET>". Without CRON_SECRET set, it refuses every request.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || given.length !== want.length || !timingSafeEqual(given, want)) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(await flushOutbox(25));
}
