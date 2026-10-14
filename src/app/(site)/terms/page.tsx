import { TrustPage } from "@/components/seo/TrustPage";
import { pageMetadata } from "@/seo/page-metadata";
import { getPageById } from "@/seo/select";

const page = getPageById("terms");
export const metadata = pageMetadata(page);
export default function Page() {
  return <TrustPage page={page} />;
}
