import Link from "next/link";
import { CATEGORIES, FEATURED, TEMPLATES, getTemplate } from "@/data/templates";
import { PRICE_LABEL, SUPPORT_WHATSAPP } from "@/config/site";
import { PreviewButton } from "@/components/preview/PreviewProvider";
import { CustomizeLink } from "./Actions";
import { HeroStage, RsvpDemoCard } from "./Client";
import { InvitationPhoneMockup } from "./InvitationPhoneMockup";
import { Price } from "./Price";

export function Hero() {
  const centre = getTemplate("scenic-romance")!;
  const left = getTemplate("royal-emerald")!;
  const right = getTemplate("ivory-wax-seal")!;
  return (
    <section className="hero">
      <div className="wrap hero-in">
        <div className="hero-copy">
          <h1>Invitations worth opening.</h1>
          <p className="hero-sub">Create a beautiful digital invitation, personalize every detail, and know exactly who’s coming.</p>
          <div className="hero-cta">
            <a className="btn btn-solid" href="#templates">Explore Templates</a>
            <a className="btn btn-line" href="/create">Create Invitation</a>
          </div>
          <p className="hero-note">Every template {PRICE_LABEL} • RSVP included</p>
        </div>
        <HeroStage>
          <PreviewButton slug={left.slug} className="hp hp-l" label={`Preview ${left.name}`}><InvitationPhoneMockup t={left} priority shadow="deep" sizes="(max-width: 720px) 38vw, 212px" /></PreviewButton>
          <PreviewButton slug={right.slug} className="hp hp-r" label={`Preview ${right.name}`}><InvitationPhoneMockup t={right} priority shadow="deep" sizes="(max-width: 720px) 38vw, 212px" /></PreviewButton>
          <PreviewButton slug={centre.slug} className="hp hp-c" label={`Preview ${centre.name}`}><InvitationPhoneMockup t={centre} priority shadow="deep" sizes="(max-width: 720px) 44vw, 250px" /></PreviewButton>
        </HeroStage>
      </div>
    </section>
  );
}

export function Featured() {
  return (
    <section className="band featured" aria-labelledby="feat-h">
      <div className="wrap">
        <div className="sec-head">
          <h2 id="feat-h">Featured templates</h2>
          <p>Three favourites. Each one opens differently.</p>
        </div>
        <div className="feat-rows">
          {FEATURED.map((t) => (
            <article key={t.slug} className="feat-row">
              <PreviewButton slug={t.slug} className="feat-art" label={`Preview ${t.name}`}>
                <span className="feat-plinth" style={{ background: t.theme.plinth }} aria-hidden="true" />
                <InvitationPhoneMockup t={t} variant="alt" className="feat-phone-b" sizes="(max-width: 720px) 34vw, 220px" />
                <InvitationPhoneMockup t={t} className="feat-phone-a" shadow="deep" sizes="(max-width: 720px) 38vw, 250px" />
              </PreviewButton>
              <div className="feat-copy">
                <p className="feat-cat">{t.category}</p>
                <h3>{t.name}</h3>
                <p className="feat-blurb">{t.blurb}</p>
                <p className="feat-open"><span>How it opens</span>{t.opening}</p>
                <p className="feat-price"><Price /></p>
                <div className="pair">
                  <PreviewButton slug={t.slug} className="btn btn-quiet">Preview</PreviewButton>
                  <CustomizeLink slug={t.slug} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps: [string, string, React.ReactNode][] = [
    ["Choose a template", "Open any design and try it exactly as your guests will.", <span key="v" className="hv-phone" />],
    ["Customize your invitation", "Add your names, date, venue, photos and events. It saves as you go.", <span key="v" className="hv-form"><i /><i /><i /><i /></span>],
    ["Pay & publish", `One payment of ${PRICE_LABEL}. Your invitation goes live straight away.`, <span key="v" className="hv-pay">{PRICE_LABEL}</span>],
    ["Share and track RSVPs", "Send your link. Watch replies and guest numbers come in.", <span key="v" className="hv-stats"><i /><i /><i /></span>],
  ];
  return (
    <section className="band band-cream how" aria-labelledby="how-h">
      <div className="wrap">
        <h2 id="how-h" className="how-h">From template to guest list in four steps.</h2>
        <ol className="how-list">
          {steps.map(([h, p, vis], i) => (
            <li key={h}>
              <div className="how-vis" aria-hidden="true">{vis}</div>
              <div>
                <span className="how-n">0{i + 1}</span>
                <h3>{h}</h3>
                <p>{p}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Why() {
  const points = [
    ["It opens like the real thing", "A seal breaks, doors swing, a ribbon comes undone. Guests tap once and the invitation unfolds before they read a word."],
    ["Made for the phone in their hand", "Every design is built for a phone screen first, because that is where your guests will open it."],
    ["You are in control", "Edit every detail yourself and see it change. Fix a time or add an event after publishing, and the link stays the same."],
    ["Everything in one link", "Events, a live countdown, directions, your photographs, music and replies, all in one place."],
  ];
  return (
    <section className="band why" aria-labelledby="why-h">
      <div className="wrap why-in">
        <h2 id="why-h">Why YoureIn</h2>
        <dl className="why-list">
          {points.map(([h, p]) => (
            <div key={h}>
              <dt>{h}</dt>
              <dd>{p}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function RsvpDemo() {
  return (
    <section className="band band-cream know" aria-labelledby="know-h">
      <div className="wrap know-in">
        <div className="know-copy">
          <h2 id="know-h">Know who’s coming.</h2>
          <p>Guests can RSVP directly from your invitation, so you always know how many people to expect.</p>
        </div>
        <div className="know-stage">
          <RsvpDemoCard />
          <div className="demo-card">
            <p className="demo-label">What you see (example numbers)</p>
            <div className="stat-grid">
              <div className="stat"><b>126</b><span>Confirmed</span></div>
              <div className="stat"><b>18</b><span>Maybe</span></div>
              <div className="stat"><b>14</b><span>Declined</span></div>
              <div className="stat stat-big">
                <b>187</b><span>Total attending</span>
                <div className="meter" role="img" aria-label="187 of 300 places taken"><i style={{ width: "62%" }} /></div>
                <p className="meter-note">187 of 300 places</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const INCLUDES = ["Interactive invitation", "RSVP", "Gallery", "Google Maps", "Countdown", "Music", "Guest tracking", "Shareable link"];

export function Pricing() {
  return (
    <section className="band band-dark price" aria-labelledby="price-h">
      <div className="wrap price-in">
        <h2 id="price-h">Every design. <span><Price />.</span></h2>
        <p className="price-lines">One payment when you publish.<br />No subscription.</p>
        <ul className="price-inc">{INCLUDES.map((x) => <li key={x}>{x}</li>)}</ul>
        <a className="btn btn-light" href="#templates">Browse Templates</a>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="band final" aria-labelledby="final-h">
      <div className="wrap final-in">
        <h2 id="final-h">Pick a design and make it yours.</h2>
        <p>Customize for free. You only pay when you are ready to publish.</p>
        <div className="hero-cta">
          <a className="btn btn-solid" href="/create">Create Invitation</a>
          <a className="btn btn-line" href="#templates">Explore Templates</a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap foot-in">
        <div>
          <Link href="/" className="logo">YoureIn</Link>
          <p className="foot-tag">Invitations worth opening.</p>
        </div>
        <nav aria-label="Categories" className="foot-links">
          {CATEGORIES.map((c) => <Link key={c} href={`/?category=${encodeURIComponent(c)}#templates`}>{c}</Link>)}
        </nav>
        <nav aria-label="Account" className="foot-links">
          <a href="/create">Create an invitation</a>
          <a href="/dashboard">My invitations</a>
          <a href="/signin">Sign in</a>
          {SUPPORT_WHATSAPP && <a href={`https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">Help on WhatsApp</a>}
        </nav>
      </div>
      <div className="wrap foot-base">
        <p>© {new Date().getFullYear()} YoureIn. {TEMPLATES.length} animated invitation designs, {PRICE_LABEL} each.</p>
      </div>
    </footer>
  );
}
