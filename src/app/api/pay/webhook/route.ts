import { NextResponse } from "next/server";
import { ApiError } from "@/server/http";
import { handleWebhook } from "@/server/payments";

/** Razorpay calls this server to server, so there is no browser origin to check; the signature is the proof. */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    return NextResponse.json(await handleWebhook(raw, req.headers.get("x-razorpay-signature")));
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[yourein] webhook failed:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
