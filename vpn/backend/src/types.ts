export interface ServerRow {
  id: string;
  name: string;
  country_code: string;
  city: string;
  tier: "free" | "premium";
  enabled: boolean;
  status: "online" | "maintenance" | "offline";
  endpoint_host: string;
  endpoint_port: number;
  public_key: string;
  ipv4_cidr: string;
  ipv6_cidr: string | null;
  dns: string[];
  mtu: number | null;
  agent_url: string;
  agent_secret_sealed: string;
  probe_host: string;
  probe_port: number;
  capacity: number;
  load_percent: number | null;
  active_peers: number | null;
  rx_bytes: string | null;
  tx_bytes: string | null;
  failures: number;
  last_seen_at: Date | null;
}

export interface PlanSettings {
  productId: string;
  monthlyBasePlan: string;
  yearlyBasePlan: string;
  freeDeviceLimit: number;
  premiumDeviceLimit: number;
  estimatedMonthlyPriceUsd: number | null;
  estimatedYearlyPriceUsd: number | null;
}
