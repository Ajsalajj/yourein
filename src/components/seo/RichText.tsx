import Link from "next/link";

/** Plain text with [label](/internal-path) links, nothing else. Keeps copy in data files readable. */
export function RichText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<Link key={m.index} href={m[2]}>{m[1]}</Link>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Internal link paths found in a piece of copy, used by the audit script. */
export function linksIn(text: string): string[] {
  return [...text.matchAll(/\[[^\]]+\]\((\/[^)\s]*)\)/g)].map((m) => m[1]);
}
