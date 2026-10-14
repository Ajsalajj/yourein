import { TrustPage } from "@/components/seo/TrustPage";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/config/site";
import { pageMetadata } from "@/seo/page-metadata";
import { getPageById } from "@/seo/select";

const page = getPageById("contact");
/** With no contact method listed the page has nothing to offer, so it is kept out of search results. */
export const metadata = pageMetadata({ ...page, noindex: !SUPPORT_EMAIL && !SUPPORT_WHATSAPP });

export default function Page() {
  const wa = SUPPORT_WHATSAPP.replace(/\D/g, "");
  return (
    <TrustPage page={page}>
      <div className="seo-contact">
        <dl>
          {SUPPORT_EMAIL && (
            <div>
              <dt>Email</dt>
              <dd><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></dd>
            </div>
          )}
          {wa && (
            <div>
              <dt>WhatsApp</dt>
              <dd><a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a></dd>
            </div>
          )}
          {!SUPPORT_EMAIL && !wa && (
            <div>
              <dt>Support</dt>
              <dd>Our support address is being set up and will be listed here.</dd>
            </div>
          )}
          <div>
            <dt>Useful to include</dt>
            <dd>The email you signed up with and, for a payment question, the date and amount. Please never send passwords.</dd>
          </div>
        </dl>
      </div>
    </TrustPage>
  );
}
