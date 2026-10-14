import type { Metadata } from "next";
import "../app.css";
import "./admin.css";

/** Never indexed. No chrome here: each page wraps itself in AdminShell after its access check, so non-admins see a plain 404. */
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
