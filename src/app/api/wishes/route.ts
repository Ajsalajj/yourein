import { ApiError, body, clientIp, ok, rateLimit, route } from "@/server/http";
import { getPublished } from "@/server/invitations";
import { addWish, type WishInput } from "@/server/wishes";

/** Public: a guest leaves a wish on an invitation's guestbook. JSON, or a form with an optional `photo` file. */
export const POST = route(async (req) => {
  rateLimit(`wish:${clientIp(req)}`, 30, 10 * 60_000);
  let b: WishInput & { invitation?: unknown; guest?: unknown };
  let photo: Uint8Array | undefined;
  if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
    if (Number(req.headers.get("content-length") || 0) > 4_000_000) throw new ApiError(413, "That photo is too large.");
    const form = await req.formData().catch(() => null);
    if (!form) throw new ApiError(400, "The request could not be read.");
    b = { invitation: form.get("invitation"), guest: form.get("guest"), name: form.get("name"), message: form.get("message") };
    const file = form.get("photo");
    if (file && typeof file !== "string" && file.size > 0) {
      rateLimit(`wish-photo:${clientIp(req)}`, 10, 10 * 60_000);
      photo = new Uint8Array(await file.arrayBuffer());
    }
  } else {
    b = await body<WishInput & { invitation?: unknown; guest?: unknown }>(req);
  }
  const inv = await getPublished(String(b.invitation ?? ""));
  if (!inv) throw new ApiError(404, "This invitation could not be found.");
  const wish = await addWish(inv, typeof b.guest === "string" && b.guest ? b.guest : null, b, photo);
  return ok({ wish });
});
