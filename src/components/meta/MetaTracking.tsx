"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { trackingAllowedOn } from "@/config/meta";
import { ensurePixel, getConsent, onConsentChange, pixelId, setConsent, trackDesignEvent, trackPageView } from "@/lib/meta-pixel";

export const OPEN_AD_SETTINGS = "yi:open-ad-settings";

/**
 * Mounted once in the root layout. Without NEXT_PUBLIC_META_PIXEL_ID it renders nothing and does nothing.
 * Otherwise it asks for advertising-cookie consent (never on guests' invitation pages or the admin area),
 * loads the Pixel only after consent, and sends one PageView per page.
 */
export function MetaTracking() {
  const pathname = usePathname() || "/";
  const allowed = !!pixelId() && trackingAllowedOn(pathname);
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    setAsk(getConsent() === null);
    ensurePixel();
    trackPageView(pathname);
  }, [allowed, pathname]);

  useEffect(() => {
    if (!pixelId()) return;
    const reopen = () => setAsk(true);
    window.addEventListener(OPEN_AD_SETTINGS, reopen);
    const off = onConsentChange(() => setAsk(false));
    /* "Customize" is a plain link to /start/<slug>; one delegated listener sees every one of them */
    const onClick = (e: MouseEvent) => {
      if (!trackingAllowedOn(location.pathname)) return;
      const slug = (e.target as Element | null)?.closest?.("[data-customize]")?.getAttribute("data-customize");
      /* the server checks the slug is a real design and adds its name and category */
      if (slug && /^[a-z0-9-]{1,60}$/.test(slug)) trackDesignEvent("CustomizeInvitation", { slug });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      window.removeEventListener(OPEN_AD_SETTINGS, reopen);
      off();
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, []);

  if (!allowed || !ask) return null;
  const choose = (c: "granted" | "denied") => {
    setConsent(c);
    setAsk(false);
    if (c === "granted") trackPageView(pathname);
  };
  return (
    <div className="ad-consent" role="dialog" aria-live="polite" aria-label="Advertising cookies">
      <p>
        May we use Meta advertising cookies? They help us see which of our Facebook and Instagram ads bring people here.
        Your invitations, guests and replies are never shared. <a href="/privacy">Learn more</a>
      </p>
      <div className="ad-consent-btns">
        <button type="button" className="btn btn-quiet" onClick={() => choose("denied")}>No thanks</button>
        <button type="button" className="btn btn-solid" onClick={() => choose("granted")}>Allow</button>
      </div>
    </div>
  );
}

/** Footer link that reopens the choice. Hidden when the Pixel is not configured. */
export function AdSettingsLink() {
  if (!pixelId()) return null;
  return (
    <>
      {" · "}
      <button type="button" className="text-link foot-cookie" onClick={() => window.dispatchEvent(new Event(OPEN_AD_SETTINGS))}>Cookie settings</button>
    </>
  );
}
