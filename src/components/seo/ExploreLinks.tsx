import Link from "next/link";
import { templatesIn } from "@/data/templates";
import "./seo.css";

const GROUPS: { heading: string; links: [string, string, string][] }[] = [
  { heading: "By occasion", links: [["Wedding invitations", "/wedding-invitations", `${templatesIn("Wedding").length} animated designs`], ["Nikah invitations", "/nikah-invitations", "Moons, lanterns and palaces"], ["Engagement invitations", "/engagement-invitations", "Soft, light designs"]] },
  { heading: "By style", links: [["Floral wedding invitations", "/wedding-invitations/floral", "Roses, blossom and marigold"], ["Royal wedding invitations", "/wedding-invitations/royal", "Palaces and gold"], ["Minimal wedding invitations", "/wedding-invitations/minimal", "Quiet, paper-led cards"], ["Indian wedding invitations", "/wedding-invitations/indian", "Mandap, temple and palace"]] },
  { heading: "What is included", links: [["RSVP", "/features/rsvp", "Replies with guest counts"], ["Guest tracking", "/features/guest-tracking", "See who has replied"], ["Music", "/features/music", "Plays only when guests tap"], ["QR codes", "/features/qr-code", "For cards and posters"]] },
  { heading: "Learn more", links: [["How to create a digital wedding invitation", "/guides/how-to-create-a-digital-wedding-invitation", "A step-by-step guide"], ["Kerala wedding invitations", "/india/kerala", "Kasavu and temple designs"], ["All guides", "/guides", "Practical how-tos"]] },
];

/** Crawlable links to the main landing pages, on the home page, with no JavaScript needed. */
export function ExploreLinks() {
  return (
    <section className="band" aria-labelledby="explore-h">
      <div className="wrap">
        <div className="sec-head">
          <h2 id="explore-h">Find the right invitation</h2>
          <p>Start from the occasion, the look you have in mind, or the feature you need.</p>
        </div>
        <div className="seo-explore">
          {GROUPS.map((g) => (
            <div key={g.heading}>
              <h3>{g.heading}</h3>
              <ul>
                {g.links.map(([label, href, note]) => (
                  <li key={href}>
                    <Link href={href}>{label}</Link>
                    <small>{note}</small>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
