/**
 * Database schema. Plain PostgreSQL, safe to run repeatedly.
 * Amounts are stored in the smallest currency unit (paise).
 * Calendar dates are stored as 'YYYY-MM-DD' text so they never shift with time zones.
 */
export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = /* sql */ `
create table if not exists users (
  id uuid primary key,
  email text not null unique,
  name text not null default '',
  password_hash text,
  google_sub text unique,
  created_at timestamptz not null default now()
);

/* guests: visitors customizing before they sign in. They have no email until they claim an account. */
alter table users add column if not exists guest boolean not null default false;
alter table users alter column email drop not null;

create table if not exists sessions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists password_resets (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists auth_attempts (
  id bigserial primary key,
  key text not null,
  created_at timestamptz not null default now()
);
create index if not exists auth_attempts_key_idx on auth_attempts (key, created_at);

create table if not exists templates (
  slug text primary key,
  name text not null,
  category text not null,
  price int not null,
  currency text not null default 'INR',
  active boolean not null default true
);

create table if not exists invitations (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  template_slug text not null references templates(slug),
  slug text unique,
  status text not null default 'draft' check (status in ('draft', 'ready', 'published', 'archived')),
  title text not null default '',
  event_type text not null default '',
  event_date text not null default '',
  data jsonb not null default '{}'::jsonb,
  views int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists invitations_user_idx on invitations (user_id, updated_at desc);

create table if not exists events (
  id uuid primary key,
  invitation_id uuid not null references invitations(id) on delete cascade,
  position int not null default 0,
  title text not null,
  event_date text not null default '',
  event_time text not null default '',
  place text not null default '',
  note text not null default ''
);
create index if not exists events_invitation_idx on events (invitation_id, position);

create table if not exists photos (
  id uuid primary key,
  invitation_id uuid not null references invitations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('portrait', 'gallery', 'music')),
  mime text not null,
  bytes bytea not null,
  size int not null,
  created_at timestamptz not null default now()
);
create index if not exists photos_invitation_idx on photos (invitation_id);

create table if not exists guests (
  id uuid primary key,
  invitation_id uuid not null references invitations(id) on delete cascade,
  slug text not null,
  name text not null,
  phone text not null default '',
  email text not null default '',
  group_name text not null default '',
  invited_count int not null default 1,
  max_attendees int,
  note text not null default '',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (invitation_id, slug)
);

alter table guests add column if not exists private_events jsonb not null default '[]'::jsonb;

create table if not exists rsvps (
  id uuid primary key,
  invitation_id uuid not null references invitations(id) on delete cascade,
  guest_id uuid references guests(id) on delete set null,
  guest_name text not null,
  response_status text not null check (response_status in ('yes', 'maybe', 'no')),
  attendee_count int not null default 0,
  phone text not null default '',
  meal_preference text not null default '',
  message text not null default '',
  edit_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table rsvps add column if not exists events jsonb not null default '{}'::jsonb;
alter table rsvps add column if not exists answers jsonb not null default '{}'::jsonb;
create index if not exists rsvps_invitation_idx on rsvps (invitation_id, created_at desc);
create unique index if not exists rsvps_guest_uq on rsvps (guest_id) where guest_id is not null;

create table if not exists wishes (
  id uuid primary key,
  invitation_id uuid not null references invitations(id) on delete cascade,
  guest_id uuid references guests(id) on delete set null,
  name text not null,
  message text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists wishes_invitation_idx on wishes (invitation_id, created_at desc);

create table if not exists orders (
  id uuid primary key,
  invitation_id uuid not null references invitations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  amount int not null,
  currency text not null,
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  provider text not null,
  provider_order_id text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists orders_invitation_idx on orders (invitation_id);

create table if not exists payments (
  id uuid primary key,
  order_id uuid not null references orders(id) on delete cascade,
  provider_payment_id text not null unique,
  amount int not null,
  currency text not null,
  status text not null,
  signature text not null default '',
  paid_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists analytics (
  id bigserial primary key,
  invitation_id uuid not null references invitations(id) on delete cascade,
  guest_id uuid,
  type text not null,
  created_at timestamptz not null default now()
);
create index if not exists analytics_invitation_idx on analytics (invitation_id, type);
`;
