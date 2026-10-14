import { serializeLd } from "@/seo/jsonld";

/** Structured data, rendered on the server so crawlers see it without running scripts. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeLd(data) }} />;
}
