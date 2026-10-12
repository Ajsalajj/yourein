/** The YoureIn wordmark (public/logo.svg). Size it with CSS height on .logo img. */
export function Logo({ alt = "YoureIn" }: { alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.svg" alt={alt} width={174} height={37} className="logo-img" decoding="async" />;
}
