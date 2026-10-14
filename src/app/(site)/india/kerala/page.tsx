import { SeoPageView } from "@/components/seo/SeoPageView";
import { pageMetadata } from "@/seo/page-metadata";
import { getPageById } from "@/seo/select";

const page = getPageById("kerala");
export const metadata = pageMetadata(page);

export default function Page() {
  return <SeoPageView page={page} collectionHeading="Designs drawn for Kerala" />;
}
