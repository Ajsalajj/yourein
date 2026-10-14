import type { PaymentState } from "@/server/admin";

export function StateBadge({ state, label }: { state: PaymentState; label: string }) {
  return <span className={`adm-badge is-${state}`}>{label}</span>;
}
