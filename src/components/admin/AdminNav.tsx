"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

const ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/invitations", label: "Invitations" },
  { href: "/admin/setup", label: "Setup" },
];

export function AdminNav() {
  const path = usePathname();
  const router = useRouter();
  const lock = async () => {
    await fetch("/api/admin/lock", { method: "POST" });
    router.push("/admin/unlock");
    router.refresh();
  };
  return (
    <header className="adm-top">
      <Link href="/admin" className="logo" aria-label="YoureIn admin"><Logo alt="" /></Link>
      <span className="adm-tag">Admin</span>
      <nav className="adm-nav" aria-label="Admin sections">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} aria-current={(i.href === "/admin" ? path === "/admin" : path.startsWith(i.href)) ? "page" : undefined}>{i.label}</Link>
        ))}
      </nav>
      <div className="adm-right">
        <Link href="/dashboard">My invitations</Link>
        <button type="button" className="btn btn-quiet btn-sm" onClick={lock}>Lock</button>
      </div>
    </header>
  );
}
