import { AdminNav } from "./AdminNav";

/** The admin chrome. Pages render it only after the access check passes, so a stranger's 404 never shows it. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="adm">
      <AdminNav />
      <div className="adm-body">{children}</div>
    </div>
  );
}
