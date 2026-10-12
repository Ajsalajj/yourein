"use client";

import { useEffect, useRef, useState } from "react";

export function StartClient({ slug, name, signedOut }: { slug: string; name: string; signedOut: boolean }) {
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const json = { "Content-Type": "application/json" };
    /* signed-out visitors customize as a guest; sign-in comes at payment */
    (signedOut ? fetch("/api/auth/guest", { method: "POST", headers: json, body: "{}" }) : Promise.resolve(null))
      .then((res) => {
        if (res && !res.ok) throw new Error("We could not start your invitation.");
        return fetch("/api/invitations", { method: "POST", headers: json, body: JSON.stringify({ template: slug, tz, reuse: true }) });
      })
      .then(async (res) => {
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || "We could not start your invitation.");
        window.location.replace(`/edit/${out.id}`);
      })
      .catch((e: Error) => setError(e.message));
  }, [slug, signedOut]);

  return (
    <div className="auth">
      <main className="auth-card auth-wait" role="status">
        {error ? (
          <>
            <h1>That did not work.</h1>
            <p className="auth-sub">{error}</p>
            <a className="btn btn-solid btn-block" href={`/start/${slug}`}>Try again</a>
          </>
        ) : (
          <>
            <span className="spinner" aria-hidden="true" />
            <h1>Setting up {name}.</h1>
            <p className="auth-sub">Your editor opens in a moment.</p>
          </>
        )}
      </main>
    </div>
  );
}
