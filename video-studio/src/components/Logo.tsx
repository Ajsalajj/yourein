import Link from "next/link";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Cadence home">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="1" y="1" width="22" height="22" rx="6" fill="#8b7bff" />
        <path d="M6 15.5V8.5M10 18V6M14 14V10M18 16.5V7.5" stroke="#0b0c10" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span>Cadence</span>
    </Link>
  );
}

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="flex items-center gap-1 text-[13px] text-mute" aria-label="Main">
          <Link className="rounded-md px-3 py-1.5 hover:bg-panel-2 hover:text-text" href="/projects">Projects</Link>
          <Link className="rounded-md px-3 py-1.5 hover:bg-panel-2 hover:text-text" href="/templates">Templates</Link>
          <Link className="rounded-md px-3 py-1.5 hover:bg-panel-2 hover:text-text" href="/settings">Settings</Link>
          <Link className="ml-2 rounded-lg bg-accent px-3.5 py-1.5 font-semibold text-[#0b0c10] hover:bg-[#a094ff]" href="/upload">New video</Link>
        </nav>
      </div>
    </header>
  );
}
