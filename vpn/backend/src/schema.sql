-- Orvane schema. Idempotent: safe to run on every start.
--
-- Privacy by design: there is no table for connections, sessions, traffic,
-- DNS or IP addresses of users. Gateways report only aggregate counters.

create table if not exists users (
  id uuid primary key,                 -- Supabase auth user id
  email text not null,
  created_at timestamptz not null default now(),
  suspended_at timestamptz,
  suspended_reason text
);

create table if not exists subscriptions (
  purchase_token text primary key,     -- Google Play purchase token
  user_id uuid not null references users(id) on delete cascade,
  product_id text not null,
  base_plan_id text,
  state text not null,                 -- active | grace | on_hold | paused | canceled | expired | pending
  expires_at timestamptz,
  auto_renewing boolean not null default false,
  acknowledged boolean not null default false,
  replaced_by text,                    -- set when a linked (upgrade/resubscribe) token supersedes this one
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists subscriptions_user on subscriptions(user_id);

create table if not exists servers (
  id text primary key,                 -- e.g. "nl-ams-1"
  name text not null,
  country_code char(2) not null,
  city text not null,
  tier text not null check (tier in ('free', 'premium')),
  enabled boolean not null default true,
  status text not null default 'offline' check (status in ('online', 'maintenance', 'offline')),
  endpoint_host text not null,         -- WireGuard UDP endpoint
  endpoint_port int not null default 51820,
  public_key text not null,            -- gateway WireGuard public key
  ipv4_cidr cidr not null,             -- client address pool; .1 is the gateway
  ipv6_cidr cidr,
  dns text[] not null,                 -- resolvers reachable inside the tunnel
  mtu int,
  agent_url text not null,             -- https://host:port of the gateway agent
  agent_secret_sealed text not null,   -- AES-GCM sealed HMAC secret
  probe_host text not null,
  probe_port int not null,
  capacity int not null default 1000,  -- peers considered 100% load
  load_percent int,
  active_peers int,
  rx_bytes bigint,
  tx_bytes bigint,
  failures int not null default 0,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  platform text not null,
  public_key text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create index if not exists devices_user on devices(user_id);

create table if not exists peers (
  device_id uuid not null references devices(id) on delete cascade,
  server_id text not null references servers(id) on delete cascade,
  ipv4 inet not null,
  ipv6 inet,
  created_at timestamptz not null default now(),
  primary key (device_id, server_id),
  unique (server_id, ipv4)
);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into settings (key, value) values
  ('plans', '{"productId":"orvane_premium","monthlyBasePlan":"monthly","yearlyBasePlan":"yearly","freeDeviceLimit":1,"premiumDeviceLimit":5,"estimatedMonthlyPriceUsd":null,"estimatedYearlyPriceUsd":null}')
  on conflict (key) do nothing;

create table if not exists audit_log (
  id bigserial primary key,
  actor_id uuid,
  actor_email text,
  action text not null,
  target text,
  details jsonb,
  at timestamptz not null default now()
);
create index if not exists audit_log_at on audit_log(at desc);

-- Gateways whose peers must be re-synced (e.g. a revocation failed because
-- the agent was unreachable). The monitor retries these.
create table if not exists pending_revocations (
  server_id text not null references servers(id) on delete cascade,
  public_key text not null,
  created_at timestamptz not null default now(),
  primary key (server_id, public_key)
);
