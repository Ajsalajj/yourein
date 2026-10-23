import { redirect } from "next/navigation";

/** The design shown in our ads. Change it here to point every /try link at another design. */
export const DEFAULT_TRY_DESIGN = "golden-palace";

/** /try opens the default design; campaign tags in the link (utm_*, fbclid) are kept. */
export default async function TryIndex({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") q.set(k, v);
  redirect(`/try/${DEFAULT_TRY_DESIGN}${q.size ? `?${q}` : ""}`);
}
