import { notFound } from "next/navigation";
import { SeoPageView } from "@/components/seo/SeoPageView";
import { pageMetadata } from "@/seo/page-metadata";
import { ALL_PAGES, getPageByPath } from "@/seo/select";

type Props = { params: Promise<{ style: string }> };

/** Only the approved style pages exist. Any other /wedding-invitations/<word> is a real 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_PAGES.filter((p) => p.type === "style").map((p) => ({ style: p.style! }));
}

export async function generateMetadata({ params }: Props) {
  const page = getPageByPath(`/wedding-invitations/${(await params).style}`);
  return page ? pageMetadata(page) : {};
}

export default async function Page({ params }: Props) {
  const page = getPageByPath(`/wedding-invitations/${(await params).style}`);
  if (!page || page.type !== "style") notFound();
  return <SeoPageView page={page} collectionHeading={`${page.h1.replace(/ Invitations$/, "")} designs`} />;
}
