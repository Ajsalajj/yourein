import { SeoPageView } from "@/components/seo/SeoPageView";
import { pageMetadata } from "@/seo/page-metadata";
import { getPageById } from "@/seo/select";

const page = getPageById("nikah");
export const metadata = pageMetadata(page);

export default function Page() {
  return <SeoPageView page={page} collectionHeading="Nikah invitation designs" />;
}
