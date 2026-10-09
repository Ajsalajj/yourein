"use client";

import { useEffect, useRef, useState } from "react";

export function StartClient({ slug, name }: { slug: string; name: string }) {
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch("/api/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template: slug, tz, reuse: true }) })
      .then(async (res) => {
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || "We could not start your invitation.");
        window.location.replace(`/edit/${out.id}`);
      })
      .catch((e: Error) => setError(e.message));
  }, [slug]);

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
