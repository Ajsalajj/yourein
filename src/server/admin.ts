/**
 * The admin area: who may enter, and the figures and lists it shows. Read-only: nothing here changes an order,
 * a payment or an invitation. Refunds are made in the Razorpay dashboard and arrive here through the webhook.
 */
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { appSecret, getUser, type User } from "./auth";
import { ADMIN_COOKIE, adminConfigured, isAdminEmail, verifyAdminToken } from "./admin-access";
import { databaseKind, query } from "./db";
import { ApiError } from "./http";

/* ------------------------------------------------------------------ access */

/** For admin pages. Anyone who is not an admin sees the ordinary "not found" page. */
export async function requireAdminPage(opts: { allowLocked?: boolean } = {}): Promise<User> {
  if (!adminConfigured(process.env)) notFound();
  const user = await getUser();
  if (!user || user.guest) redirect("/signin?next=/admin");
  if (!isAdminEmail(user.email, process.env)) notFound();
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!opts.allowLocked && !verifyAdminToken(appSecret(), token, user.id)) redirect("/admin/unlock");
  return user;
}

/** For admin API routes. Same rules, answered with 404 so nothing is revealed. */
export async function requireAdminApi(opts: { allowLocked?: boolean } = {}): Promise<User> {
  const user = await getUser();
  if (!adminConfigured(process.env) || !user || user.guest || !isAdminEmail(user.email, process.env)) throw new ApiError(404, "Not found.");
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!opts.allowLocked && !verifyAdminToken(appSecret(), token, user.id)) throw new ApiError(404, "Not found.");
  return user;
}

export const adminDatabaseKind = () => databaseKind();

/* ------------------------------------------------------------------ shared pieces */

export type PaymentState = "paid" | "partially_refunded" | "refunded" | "failed" | "pending";
export const STATE_LABEL: Record<PaymentState, string> = { paid: "Paid", partially_refunded: "Partly refunded", refunded: "Refunded", failed: "Failed", pending: "Not completed" };

/** One row per order, with its latest relevant payment. A payment that went through wins over earlier failed attempts. */
const ORDERS = `
  select o.id as order_id, o.created_at, o.amount, o.currency, o.provider, o.provider_order_id, o.status as order_status,
         u.id as user_id, u.name as user_name, u.email as user_email,
         i.id as invitation_id, i.title as invitation_title, i.template_slug, i.status as invitation_status, i.slug as invitation_slug,
         p.provider_payment_id, p.paid_at, p.raw as payment_raw,
         case
           when p.status = 'refunded' then 'refunded'
           when p.status = 'partially_refunded' then 'partially_refunded'
           when p.status = 'captured' then 'paid'
           when o.status = 'paid' then 'paid'
           when p.status = 'failed' or o.status = 'failed' then 'failed'
           else 'pending'
         end as state,
         case
           when p.status = 'refunded' then o.amount
           when p.status = 'partially_refunded' then (select coalesce(sum(value::int), 0) from jsonb_each_text(coalesce(p.raw->'refunds', '{}'::jsonb)))
           else 0
         end::int as refunded
  from orders o
  join users u on u.id = o.user_id
  join invitations i on i.id = o.invitation_id
  left join lateral (
    select * from payments p where p.order_id = o.id
    order by (p.status in ('captured', 'refunded', 'partially_refunded')) desc, p.created_at desc limit 1
  ) p on true`;

export type PaymentFilter = { state?: PaymentState | "all"; q?: string; from?: string; to?: string; includeSimulated?: boolean; page?: number };
export type PaymentRow = {
  order_id: string; created_at: string; amount: number; currency: string; provider: string; provider_order_id: string;
  user_id: string; user_name: string; user_email: string | null; invitation_id: string; invitation_title: string; template_slug: string;
  invitation_status: string; invitation_slug: string | null; provider_payment_id: string | null; paid_at: string | null;
  payment_raw: Record<string, unknown> | null; state: PaymentState; refunded: number;
};

export const PAGE_SIZE = 25;
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

function where(f: PaymentFilter) {
  const params: unknown[] = [];
  const c: string[] = [];
  const add = (v: unknown) => (params.push(v), `$${params.length}`);
  if (!f.includeSimulated) c.push(`provider <> 'test'`);
  if (f.state && f.state !== "all") c.push(`state = ${add(f.state)}`);
  if (isDate(f.from)) c.push(`created_at >= ${add(f.from)}::date`);
  if (isDate(f.to)) c.push(`created_at < (${add(f.to)}::date + 1)`);
  const q = f.q?.trim().slice(0, 80);
  if (q) {
    const n = add(`%${q.replace(/[\\%_]/g, "\\$&")}%`);
    c.push(`(user_email ilike ${n} or user_name ilike ${n} or invitation_title ilike ${n} or provider_order_id ilike ${n} or coalesce(provider_payment_id, '') ilike ${n})`);
  }
  return { clause: c.length ? `where ${c.join(" and ")}` : "", params };
}

export async function listPayments(f: PaymentFilter, opts: { all?: boolean } = {}): Promise<{ rows: PaymentRow[]; total: number; page: number }> {
  const { clause, params } = where(f);
  const page = Math.max(1, Math.floor(f.page ?? 1));
  const limit = opts.all ? "limit 5000" : `limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`;
  const rows = await query<PaymentRow & { total: string }>(`select *, count(*) over() as total from (${ORDERS}) t ${clause} order by created_at desc ${limit}`, params);
  return { rows, total: rows[0] ? Number(rows[0].total) : 0, page };
}

/* ------------------------------------------------------------------ overview */

export type Overview = {
  grossPaise: number; refundedPaise: number; netPaise: number; paid: number; failed: number; refunded: number; pending: number;
  last7: number; last30: number; today: number;
  customers: number; invitations: Record<string, number>; simulatedPayments: number;
  days: { day: string; paise: number }[];
  lastWebhookAt: string | null; lastPaidAt: string | null;
};

export async function overview(includeSimulated: boolean): Promise<Overview> {
  const real = includeSimulated ? "" : `where provider <> 'test'`;
  const [t] = await query<Record<string, string>>(
    `select
       coalesce(sum(amount) filter (where state in ('paid','partially_refunded','refunded')), 0) as gross,
       coalesce(sum(refunded), 0) as refunded,
       count(*) filter (where state = 'paid') as paid,
       count(*) filter (where state = 'failed') as failed,
       count(*) filter (where state in ('refunded','partially_refunded')) as refunded_n,
       count(*) filter (where state = 'pending') as pending,
       coalesce(sum(amount - refunded) filter (where state in ('paid','partially_refunded','refunded') and paid_at >= now() - interval '1 day'), 0) as today,
       coalesce(sum(amount - refunded) filter (where state in ('paid','partially_refunded','refunded') and paid_at >= now() - interval '7 days'), 0) as d7,
       coalesce(sum(amount - refunded) filter (where state in ('paid','partially_refunded','refunded') and paid_at >= now() - interval '30 days'), 0) as d30,
       max(paid_at) as last_paid,
       max(created_at) filter (where payment_raw->>'source' = 'webhook') as last_webhook
     from (${ORDERS}) t ${real}`,
  );
  const dayRows = await query<{ day: string; paise: string }>(
    `select to_char(d, 'YYYY-MM-DD') as day, coalesce(sum(t.amount - t.refunded), 0) as paise
     from generate_series(current_date - 29, current_date, interval '1 day') d
     left join (${ORDERS}) t on t.paid_at::date = d::date and t.state in ('paid','partially_refunded','refunded') ${includeSimulated ? "" : `and t.provider <> 'test'`}
     group by d order by d`,
  );
  const [c] = await query<{ n: string }>(`select count(*) as n from users where not guest`);
  const inv = await query<{ status: string; n: string }>(`select status, count(*) as n from invitations group by status`);
  const [sim] = await query<{ n: string }>(`select count(*) as n from orders where provider = 'test' and status = 'paid'`);
  const gross = Number(t.gross), refunded = Number(t.refunded);
  return {
    grossPaise: gross, refundedPaise: refunded, netPaise: gross - refunded, paid: Number(t.paid), failed: Number(t.failed), refunded: Number(t.refunded_n), pending: Number(t.pending),
    today: Number(t.today), last7: Number(t.d7), last30: Number(t.d30), customers: Number(c.n),
    invitations: Object.fromEntries(inv.map((r) => [r.status, Number(r.n)])), simulatedPayments: Number(sim.n),
    days: dayRows.map((r) => ({ day: r.day, paise: Number(r.paise) })), lastWebhookAt: t.last_webhook ?? null, lastPaidAt: t.last_paid ?? null,
  };
}

/* ------------------------------------------------------------------ customers and invitations */

export type CustomerRow = { id: string; name: string; email: string | null; created_at: string; invitations: number; published: number; paid_paise: number; last_paid_at: string | null; google: boolean };

/** People who have an account, with what they have bought. There are no subscriptions: each invitation is a one-time purchase. */
export async function listCustomers(q: string | undefined, page: number, includeSimulated: boolean): Promise<{ rows: CustomerRow[]; total: number; page: number }> {
  const params: unknown[] = [];
  let clause = "where not u.guest";
  const term = q?.trim().slice(0, 80);
  if (term) {
    params.push(`%${term.replace(/[\\%_]/g, "\\$&")}%`);
    clause += ` and (u.email ilike $1 or u.name ilike $1)`;
  }
  const real = includeSimulated ? "" : `and o.provider <> 'test'`;
  const p = Math.max(1, Math.floor(page));
  const rows = await query<CustomerRow & { total: string }>(
    `select u.id, u.name, u.email, u.created_at, (u.google_sub is not null) as google,
       (select count(*) from invitations i where i.user_id = u.id)::int as invitations,
       (select count(*) from invitations i where i.user_id = u.id and i.status in ('published','archived'))::int as published,
       coalesce((select sum(o.amount) from orders o where o.user_id = u.id and o.status = 'paid' ${real}), 0)::int as paid_paise,
       (select max(pa.paid_at) from payments pa join orders o on o.id = pa.order_id where o.user_id = u.id and pa.status in ('captured','refunded','partially_refunded') ${real}) as last_paid_at,
       count(*) over() as total
     from users u ${clause} order by u.created_at desc limit ${PAGE_SIZE} offset ${(p - 1) * PAGE_SIZE}`,
    params,
  );
  return { rows, total: rows[0] ? Number(rows[0].total) : 0, page: p };
}

export type InvitationRow = { id: string; title: string; template_slug: string; status: string; slug: string | null; views: number; created_at: string; published_at: string | null; owner_name: string; owner_email: string | null; replies: number; paid_paise: number };

/** Invitations with their owner and how much was paid. Counts only: no guest names or replies are shown here. */
export async function listInvitations(status: string | undefined, q: string | undefined, page: number): Promise<{ rows: InvitationRow[]; total: number; page: number }> {
  const params: unknown[] = [];
  const c = ["not u.guest"];
  if (status && ["draft", "ready", "published", "archived"].includes(status)) c.push(`i.status = $${params.push(status)}`);
  const term = q?.trim().slice(0, 80);
  if (term) {
    const n = `$${params.push(`%${term.replace(/[\\%_]/g, "\\$&")}%`)}`;
    c.push(`(u.email ilike ${n} or u.name ilike ${n} or i.title ilike ${n})`);
  }
  const p = Math.max(1, Math.floor(page));
  const rows = await query<InvitationRow & { total: string }>(
    `select i.id, i.title, i.template_slug, i.status, i.slug, i.views, i.created_at, i.published_at, u.name as owner_name, u.email as owner_email,
       (select count(*) from rsvps r where r.invitation_id = i.id)::int as replies,
       coalesce((select sum(o.amount) from orders o where o.invitation_id = i.id and o.status = 'paid' and o.provider <> 'test'), 0)::int as paid_paise,
       count(*) over() as total
     from invitations i join users u on u.id = i.user_id where ${c.join(" and ")} order by i.created_at desc limit ${PAGE_SIZE} offset ${(p - 1) * PAGE_SIZE}`,
    params,
  );
  return { rows, total: rows[0] ? Number(rows[0].total) : 0, page: p };
}

/* ------------------------------------------------------------------ formatting */

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const when = (iso: string | Date | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "none yet";

/** Spreadsheet programs run cells that start with = + - or @ as formulas. Prefixing a quote stops that. */
export const csvCell = (v: unknown): string => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
