import Link from "next/link";

export default function NotFound() {
  return (
    <main className="nf">
      <p className="logo">YoureIn</p>
      <h1>This page is not on the guest list.</h1>
      <p>The link may be old, or the design may have been renamed.</p>
      <Link className="btn btn-solid" href="/#templates">See all templates</Link>
    </main>
  );
}
