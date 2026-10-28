import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import * as A from "./api";

type Page = "overview" | "users" | "servers" | "plans" | "audit";

// ---------------------------------------------------------------- shell

export function App() {
  const [session, setSession] = useState(A.loadSession());
  const [mfaOk, setMfaOk] = useState(false);
  const [page, setPage] = useState<Page>("overview");

  if (!A.configured) {
    return (
      <Center>
        <Card title="Dashboard not configured">
          <p className="muted">Set VITE_API_URL, VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example) and rebuild.</p>
        </Card>
      </Center>
    );
  }
  if (!session) return <SignIn onDone={setSession} />;
  if (!mfaOk && !isAal2(session)) return <Mfa session={session} onDone={(s) => { setSession(s); setMfaOk(true); }} onCancel={() => { A.signOut(); setSession(null); }} />;

  const nav: [Page, string][] = [["overview", "Overview"], ["users", "Users"], ["servers", "Gateways"], ["plans", "Plans"], ["audit", "Audit log"]];
  return (
    <div className="layout">
      <aside className="side">
        <div className="brand"><span className="orb" />Orvane <span className="tag">Admin</span></div>
        <nav>
          {nav.map(([p, label]) => (
            <button key={p} className={p === page ? "nav active" : "nav"} onClick={() => setPage(p)}>{label}</button>
          ))}
        </nav>
        <div className="who">
          <div className="muted small">{session.user.email}</div>
          <button className="link" onClick={() => { A.signOut(); setSession(null); }}>Sign out</button>
        </div>
      </aside>
      <main className="main">
        {page === "overview" && <Overview />}
        {page === "users" && <Users />}
        {page === "servers" && <Servers />}
        {page === "plans" && <Plans />}
        {page === "audit" && <Audit />}
      </main>
    </div>
  );
}

function isAal2(s: A.Session): boolean {
  try {
    return JSON.parse(atob(s.access_token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))).aal === "aal2";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- auth

function SignIn({ onDone }: { onDone: (s: A.Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      onDone(await A.signIn(email, password));
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Center>
      <form className="card auth" onSubmit={submit}>
        <div className="brand big"><span className="orb" />Orvane <span className="tag">Admin</span></div>
        <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {err && <p className="error">{err}</p>}
        <button className="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="muted small">Administrators need the admin role and two-factor authentication.</p>
      </form>
    </Center>
  );
}

function Mfa({ session, onDone, onCancel }: { session: A.Session; onDone: (s: A.Session) => void; onCancel: () => void }) {
  const [factor, setFactor] = useState<string | null | undefined>(undefined);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    A.totpFactor(session).then(setFactor).catch((e) => setErr((e as Error).message));
  }, [session]);

  const startEnroll = async () => {
    try {
      setEnroll(await A.enrollTotp(session));
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    const id = factor ?? enroll?.id;
    if (!id) return;
    try {
      onDone(await A.verifyTotp(session, id, code.trim()));
    } catch (x) {
      setErr((x as Error).message);
    }
  };

  return (
    <Center>
      <form className="card auth" onSubmit={verify}>
        <h2>Two-factor authentication</h2>
        {factor === undefined && !err && <p className="muted">Checking your factors…</p>}
        {factor === null && !enroll && (
          <>
            <p className="muted">Admin access requires an authenticator app. Set one up now.</p>
            <button type="button" className="primary" onClick={startEnroll}>Set up authenticator</button>
          </>
        )}
        {enroll && (
          <>
            <p className="muted">Scan with your authenticator app, then enter the 6-digit code.</p>
            <img className="qr" src={enroll.qr} alt="Authenticator QR code" />
            <code className="secret">{enroll.secret}</code>
          </>
        )}
        {(factor || enroll) && (
          <>
            <label>Code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" value={code} onChange={(e) => setCode(e.target.value)} required /></label>
            <button className="primary">Verify</button>
          </>
        )}
        {err && <p className="error">{err}</p>}
        <button type="button" className="link" onClick={onCancel}>Use a different account</button>
      </form>
    </Center>
  );
}

// ---------------------------------------------------------------- data hook

function useData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    A.api<T>(path).then(setData).catch((e: A.ApiError) => setError(e.code === "mfa_required" ? "Two-factor authentication required." : e.message));
  }, [path]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}

// ---------------------------------------------------------------- pages

interface Analytics {
  users: { total: number; d7: number; d30: number; suspended: number };
  devices: { total: number; active24h: number };
  subscriptions: { premiumActive: number; monthly: number; yearly: number; byState: Record<string, number> };
  revenue: { estimatedMrrUsd: number | null; note: string };
  servers: { total: number; online: number; activePeers: number; rxBytes: number; txBytes: number };
}

function Overview() {
  const { data, error } = useData<Analytics>("/admin/v1/analytics");
  if (error) return <Err msg={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <Header title="Overview" />
      <div className="kpis">
        <Kpi label="Users" value={data.users.total} sub={`+${data.users.d7} this week · +${data.users.d30} in 30 days`} />
        <Kpi label="Premium" value={data.subscriptions.premiumActive} sub={`${data.subscriptions.monthly} monthly · ${data.subscriptions.yearly} yearly`} />
        <Kpi label="Devices active (24h)" value={data.devices.active24h} sub={`${data.devices.total} registered`} />
        <Kpi label="Gateways online" value={`${data.servers.online}/${data.servers.total}`} sub={`${data.servers.activePeers} active peers`} />
      </div>
      <div className="grid2">
        <Card title="Estimated MRR">
          <div className="big-number">{data.revenue.estimatedMrrUsd === null ? "—" : `$${data.revenue.estimatedMrrUsd.toLocaleString()}`}</div>
          <p className="muted small">{data.revenue.note}{data.revenue.estimatedMrrUsd === null ? " Enter list prices under Plans to see an estimate." : ""}</p>
        </Card>
        <Card title="Subscriptions by state">
          {Object.keys(data.subscriptions.byState).length === 0 ? (
            <p className="muted">No subscriptions yet.</p>
          ) : (
            <Bars data={data.subscriptions.byState} />
          )}
        </Card>
        <Card title="Gateway traffic (aggregate counters)">
          <p><b>{A.fmtBytes(data.servers.rxBytes)}</b> received · <b>{A.fmtBytes(data.servers.txBytes)}</b> sent</p>
          <p className="muted small">Interface totals since each gateway's last restart. Orvane keeps no per-user traffic records.</p>
        </Card>
        <Card title="Accounts">
          <p>{data.users.suspended} suspended</p>
        </Card>
      </div>
    </>
  );
}

interface UserRow { id: string; email: string; createdAt: string; suspended: boolean; devices: number; premium: boolean; subscriptionState: string | null }
interface UserDetail {
  id: string; email: string; createdAt: string; suspendedAt: string | null; suspendedReason: string | null;
  devices: { id: string; name: string; platform: string; created_at: string; last_seen_at: string | null; servers: string[] }[];
  subscriptions: { product_id: string; base_plan_id: string | null; state: string; expires_at: string | null; auto_renewing: boolean; replaced: boolean }[];
}

function Users() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, reload } = useData<UserRow[]>(`/admin/v1/users?q=${encodeURIComponent(query)}`);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <Header title="Users">
        <form onSubmit={(e) => { e.preventDefault(); setQuery(q); }} className="search">
          <input placeholder="Search email or user id" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      </Header>
      {error && <Err msg={error} />}
      {!data ? <Loading /> : (
        <table>
          <thead><tr><th>Email</th><th>Plan</th><th>Devices</th><th>Joined</th><th>Status</th></tr></thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id} className="clickable" onClick={() => setOpen(u.id)}>
                <td>{u.email}</td>
                <td>{u.premium ? <span className="pill blue">Premium</span> : <span className="pill">Free</span>}</td>
                <td>{u.devices}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>{u.suspended ? <span className="pill red">Suspended</span> : <span className="pill green">Active</span>}</td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={5} className="muted">No users found.</td></tr>}
          </tbody>
        </table>
      )}
      {open && <UserDrawer id={open} onClose={() => { setOpen(null); reload(); }} />}
    </>
  );
}

function UserDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error, reload } = useData<UserDetail>(`/admin/v1/users/${id}`);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg(ok);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <div className="drawer-bg" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="User details">
        <button className="link close" onClick={onClose}>Close</button>
        {error && <Err msg={error} />}
        {!data ? <Loading /> : (
          <>
            <h2>{data.email}</h2>
            <p className="muted small mono">{data.id}</p>
            <p className="muted small">Joined {A.fmtDate(data.createdAt)}</p>
            {msg && <p className="note">{msg}</p>}
            <h3>Devices</h3>
            {data.devices.length === 0 && <p className="muted">None.</p>}
            {data.devices.map((d) => (
              <div key={d.id} className="row">
                <div>
                  <b>{d.name}</b> <span className="muted small">{d.platform}</span>
                  <div className="muted small">Last seen {A.fmtDate(d.last_seen_at)} · peers on {d.servers.length ? d.servers.join(", ") : "no gateways"}</div>
                </div>
                <button className="danger small" onClick={() => confirm(`Revoke ${d.name}? Its key stops working on every gateway.`) && act(() => A.api(`/admin/v1/devices/${d.id}`, { method: "DELETE" }), "Device revoked.")}>Revoke</button>
              </div>
            ))}
            <h3>Subscriptions</h3>
            {data.subscriptions.length === 0 && <p className="muted">None.</p>}
            {data.subscriptions.map((s, i) => (
              <div key={i} className="row">
                <div>{s.product_id} · {s.base_plan_id ?? "—"} <span className="pill">{s.state}</span>{s.replaced && <span className="muted small"> (replaced)</span>}</div>
                <div className="muted small">until {A.fmtDate(s.expires_at)}{s.auto_renewing ? " · renews" : ""}</div>
              </div>
            ))}
            <h3>Abuse handling</h3>
            {data.suspendedAt ? (
              <>
                <p>Suspended {A.fmtDate(data.suspendedAt)} — {data.suspendedReason}</p>
                <button onClick={() => act(() => A.api(`/admin/v1/users/${id}/unsuspend`, { method: "POST" }), "Account reinstated.")}>Reinstate account</button>
              </>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); void act(() => A.api(`/admin/v1/users/${id}/suspend`, { method: "POST", body: { reason } }), "Account suspended and all peers revoked."); }}>
                <label>Reason (kept in the audit log)<input value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} required /></label>
                <button className="danger">Suspend and revoke all devices</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ServerAdmin {
  id: string; name: string; countryCode: string; city: string; tier: string; enabled: boolean; status: string; endpoint: string;
  loadPercent: number | null; activePeers: number | null; allocatedPeers: number; rxBytes: number | null; txBytes: number | null;
  lastSeenAt: string | null; failures: number; capacity: number;
}

function Servers() {
  const { data, error, reload } = useData<ServerAdmin[]>("/admin/v1/servers");
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<{ id: string; agentSecret: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg(ok);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <>
      <Header title="Gateways"><button className="primary" onClick={() => setCreating(true)}>Add gateway</button></Header>
      {msg && <p className="note">{msg}</p>}
      {secret && (
        <Card title={`Agent secret for ${secret.id}`}>
          <p className="muted small">Install this as AGENT_SECRET on the gateway now. It is shown only once and stored encrypted.</p>
          <code className="secret">{secret.agentSecret}</code>
          <button onClick={() => setSecret(null)}>I've stored it</button>
        </Card>
      )}
      {error && <Err msg={error} />}
      {!data ? <Loading /> : (
        <table>
          <thead><tr><th>Gateway</th><th>Tier</th><th>Status</th><th>Load</th><th>Peers</th><th>Traffic</th><th>Last seen</th><th /></tr></thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id}>
                <td><b>{s.city}</b> <span className="muted">{s.countryCode}</span><div className="muted small mono">{s.id} · {s.endpoint}</div></td>
                <td>{s.tier === "premium" ? <span className="pill blue">Premium</span> : <span className="pill">Free</span>}</td>
                <td><span className={`pill ${s.status === "online" ? "green" : s.status === "maintenance" ? "amber" : "red"}`}>{s.enabled ? s.status : "disabled"}</span></td>
                <td><Meter value={s.loadPercent} /></td>
                <td>{s.activePeers ?? "—"} <span className="muted small">/ {s.allocatedPeers} allocated</span></td>
                <td className="small">↓ {A.fmtBytes(s.rxBytes)}<br />↑ {A.fmtBytes(s.txBytes)}</td>
                <td className="small">{A.fmtDate(s.lastSeenAt)}{s.failures > 0 && <div className="error">{s.failures} failed checks</div>}</td>
                <td className="actions">
                  <button className="small" onClick={() => act(() => A.api(`/admin/v1/servers/${s.id}/reconcile`, { method: "POST" }), `${s.id} re-synced.`)}>Re-sync</button>
                  <button className="small" onClick={() => act(() => A.api(`/admin/v1/servers/${s.id}`, { method: "PATCH", body: { maintenance: s.status !== "maintenance" } }), "Updated.")}>{s.status === "maintenance" ? "End maintenance" : "Maintenance"}</button>
                  <button className="small" onClick={() => act(() => A.api(`/admin/v1/servers/${s.id}`, { method: "PATCH", body: { enabled: !s.enabled } }), "Updated.")}>{s.enabled ? "Disable" : "Enable"}</button>
                  <button className="small" onClick={() => confirm("Generate a new agent secret? The gateway must be updated before its next check.") && A.api<{ agentSecret: string }>(`/admin/v1/servers/${s.id}`, { method: "PATCH", body: { rotateAgentSecret: true } }).then((r) => setSecret({ id: s.id, agentSecret: r.agentSecret }))}>Rotate secret</button>
                  <button className="small danger" onClick={() => confirm(`Delete ${s.id}? All its peers are dropped.`) && act(() => A.api(`/admin/v1/servers/${s.id}`, { method: "DELETE" }), "Deleted.")}>Delete</button>
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={8} className="muted">No gateways yet. Add the first one to start serving users.</td></tr>}
          </tbody>
        </table>
      )}
      {creating && <CreateServer onClose={() => setCreating(false)} onCreated={(r) => { setCreating(false); setSecret(r); reload(); }} />}
    </>
  );
}

function CreateServer({ onClose, onCreated }: { onClose: () => void; onCreated: (r: { id: string; agentSecret: string }) => void }) {
  const [f, setF] = useState({
    id: "", name: "", countryCode: "", city: "", tier: "free", endpointHost: "", endpointPort: "51820", publicKey: "",
    ipv4Cidr: "10.64.0.0/16", ipv6Cidr: "", dns: "10.64.0.1", mtu: "", agentUrl: "https://", probeHost: "", probePort: "8443", capacity: "1000",
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      onCreated(await A.api("/admin/v1/servers", {
        method: "POST",
        body: {
          ...f,
          endpointPort: Number(f.endpointPort), probePort: Number(f.probePort), capacity: Number(f.capacity),
          ipv6Cidr: f.ipv6Cidr || null, mtu: f.mtu ? Number(f.mtu) : null, dns: f.dns.split(",").map((s) => s.trim()).filter(Boolean),
        },
      }));
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  const field = (k: keyof typeof f, label: string, hint?: string) => (
    <label>{label}<input value={f[k]} onChange={set(k)} />{hint && <span className="muted small">{hint}</span>}</label>
  );
  return (
    <div className="drawer-bg" onClick={onClose}>
      <form className="drawer" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="link close" onClick={onClose}>Close</button>
        <h2>Add gateway</h2>
        <div className="form-grid">
          {field("id", "ID", "e.g. nl-ams-1")}
          {field("name", "Display name")}
          {field("countryCode", "Country code", "ISO, e.g. NL")}
          {field("city", "City")}
          <label>Tier<select value={f.tier} onChange={set("tier")}><option value="free">Free</option><option value="premium">Premium</option></select></label>
          {field("capacity", "Capacity (peers = 100% load)")}
          {field("endpointHost", "WireGuard endpoint host")}
          {field("endpointPort", "WireGuard port")}
          {field("publicKey", "Gateway public key", "wg pubkey < private.key")}
          {field("ipv4Cidr", "Client IPv4 pool", ".1 is the gateway")}
          {field("ipv6Cidr", "Client IPv6 pool (optional)")}
          {field("dns", "DNS inside tunnel", "comma-separated")}
          {field("mtu", "MTU (optional)")}
          {field("agentUrl", "Agent URL", "https only")}
          {field("probeHost", "Latency probe host")}
          {field("probePort", "Latency probe port")}
        </div>
        {err && <p className="error">{err}</p>}
        <button className="primary">Create gateway</button>
      </form>
    </div>
  );
}

interface PlanSettings {
  productId: string; monthlyBasePlan: string; yearlyBasePlan: string; freeDeviceLimit: number; premiumDeviceLimit: number;
  estimatedMonthlyPriceUsd: number | null; estimatedYearlyPriceUsd: number | null;
}

function Plans() {
  const { data, error, reload } = useData<PlanSettings>("/admin/v1/plans");
  const [draft, setDraft] = useState<PlanSettings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setDraft(data), [data]);
  if (error) return <Err msg={error} />;
  if (!draft) return <Loading />;
  const num = (k: keyof PlanSettings, nullable = false) => (e: { target: { value: string } }) =>
    setDraft({ ...draft, [k]: e.target.value === "" && nullable ? null : Number(e.target.value) });
  const str = (k: keyof PlanSettings) => (e: { target: { value: string } }) => setDraft({ ...draft, [k]: e.target.value });
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await A.api("/admin/v1/plans", { method: "PATCH", body: draft });
      setMsg("Saved. The app picks this up on next launch.");
      reload();
    } catch (x) {
      setMsg((x as Error).message);
    }
  };
  return (
    <>
      <Header title="Plans" />
      <form className="card" onSubmit={save}>
        <p className="muted small">Prices shown to users always come from Google Play (localised per country). Configure products and prices in Play Console; these settings map them to Orvane.</p>
        <div className="form-grid">
          <label>Play subscription product ID<input value={draft.productId} onChange={str("productId")} /></label>
          <label>Monthly base plan ID<input value={draft.monthlyBasePlan} onChange={str("monthlyBasePlan")} /></label>
          <label>Yearly base plan ID<input value={draft.yearlyBasePlan} onChange={str("yearlyBasePlan")} /></label>
          <label>Free device limit<input type="number" min={1} value={draft.freeDeviceLimit} onChange={num("freeDeviceLimit")} /></label>
          <label>Premium device limit<input type="number" min={1} value={draft.premiumDeviceLimit} onChange={num("premiumDeviceLimit")} /></label>
          <label>Monthly list price, USD (for estimates)<input type="number" step="0.01" min={0} value={draft.estimatedMonthlyPriceUsd ?? ""} onChange={num("estimatedMonthlyPriceUsd", true)} /></label>
          <label>Yearly list price, USD (for estimates)<input type="number" step="0.01" min={0} value={draft.estimatedYearlyPriceUsd ?? ""} onChange={num("estimatedYearlyPriceUsd", true)} /></label>
        </div>
        {msg && <p className="note">{msg}</p>}
        <button className="primary">Save</button>
      </form>
    </>
  );
}

function Audit() {
  const { data, error } = useData<{ id: number; actor_email: string; action: string; target: string | null; details: unknown; at: string }[]>("/admin/v1/audit");
  if (error) return <Err msg={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <Header title="Audit log" />
      <table>
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.id}><td className="small">{A.fmtDate(r.at)}</td><td>{r.actor_email}</td><td className="mono">{r.action}</td><td className="mono small">{r.target ?? "—"}</td><td className="mono small">{r.details ? JSON.stringify(r.details) : ""}</td></tr>
          ))}
          {data.length === 0 && <tr><td colSpan={5} className="muted">No administrative actions yet.</td></tr>}
        </tbody>
      </table>
    </>
  );
}

// ---------------------------------------------------------------- bits

const Center = ({ children }: { children: ReactNode }) => <div className="center">{children}</div>;
const Card = ({ title, children }: { title: string; children: ReactNode }) => <section className="card"><h3>{title}</h3>{children}</section>;
const Header = ({ title, children }: { title: string; children?: ReactNode }) => <header className="page-head"><h1>{title}</h1>{children}</header>;
const Loading = () => <p className="muted">Loading…</p>;
const Err = ({ msg }: { msg: string }) => <p className="error">{msg}</p>;
const Kpi = ({ label, value, sub }: { label: string; value: ReactNode; sub: string }) => (
  <div className="card kpi"><div className="muted small">{label}</div><div className="big-number">{value}</div><div className="muted small">{sub}</div></div>
);
const Meter = ({ value }: { value: number | null }) =>
  value === null ? <span className="muted">—</span> : (
    <div className="meter" title={`${value}%`}><div style={{ width: `${value}%`, background: value > 85 ? "var(--red)" : value > 60 ? "var(--amber)" : "var(--blue)" }} /><span>{value}%</span></div>
  );
function Bars({ data }: { data: Record<string, number> }) {
  const max = Math.max(...Object.values(data), 1);
  return (
    <div className="bars">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="bar-row"><span className="small">{k}</span><div className="bar"><div style={{ width: `${(v / max) * 100}%` }} /></div><b className="small">{v}</b></div>
      ))}
    </div>
  );
}
