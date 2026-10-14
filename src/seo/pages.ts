import { PRICE_LABEL } from "@/config/site";
import type { FeatureId, SeoPage, StyleId } from "./types";

/**
 * Every SEO landing page, written by hand and approved one at a time.
 *
 * Nothing here is generated from keyword combinations (no occasion x city x style x feature).
 * A page is only added when it has its own search intent, real designs to show and something useful to say.
 * Add a page here, then check it with `npm run seo:audit`.
 *
 * Copy rules: say only what the product does today; no ratings, customer counts or invented places.
 * In body text, [label](/path) makes an internal link.
 */

const UPDATED = "2026-10-14";

const HOW_IT_WORKS = {
  heading: "How it works",
  body: [
    `Pick a design and preview it with sample names. Customize it for free: add your names, date, events, venue, photographs and music. You pay ${PRICE_LABEL} once, only when you publish, and then share one link.`,
  ],
  bullets: [
    "Preview any design without an account.",
    "Customize for free. Your draft is saved as you go.",
    `Publish for ${PRICE_LABEL}, a single payment per invitation.`,
    "Share the link on WhatsApp, by email or as a QR code, and watch the replies arrive.",
  ],
};

export const OCCASION_PAGES: SeoPage[] = [
  {
    id: "wedding",
    type: "occasion",
    path: "/wedding-invitations",
    title: "Digital Wedding Invitations Online | YoureIn",
    h1: "Digital Wedding Invitations Worth Opening",
    description:
      "Create premium animated wedding invitations with RSVP, music, guest tracking, QR codes and personalized links. Browse YoureIn wedding templates online.",
    intro:
      "Each design opens like the real thing: an envelope, a palace gate, a curtain. Your guests see your names, every function, the venue and a countdown, and reply from the same page.",
    searchIntent: "Commercial: someone ready to choose an online wedding invitation design.",
    primaryKeyword: "digital wedding invitations",
    secondaryKeywords: ["online wedding invitation", "animated wedding invitation", "digital wedding card", "wedding invitation maker", "wedding invitation templates"],
    templates: { by: "category", category: "Wedding" },
    minTemplates: 6,
    occasion: "wedding",
    benefits: [
      { title: "Opens like the real thing", text: "An opening animation that is part of the design, not a video clip: seals break, gates swing, curtains part." },
      { title: "Replies in one place", text: "Guests answer yes, maybe or no, say how many are coming and reply for each function. You see it all on one dashboard." },
      { title: "One link for everyone", text: "Share one link, or give each family a personal link and a QR code so you know who replied." },
    ],
    sections: [
      HOW_IT_WORKS,
      {
        heading: "What every wedding invitation includes",
        body: [
          "Every design has the same working parts, so you choose on looks alone. Nothing is locked behind a higher price.",
        ],
        bullets: [
          "Opening animation, your names and a message from the hosts",
          "Every event with its time and place, including private ones for selected guests",
          "A live countdown and venue directions in Google Maps",
          "A photo gallery and an optional background music track",
          "RSVP with guest counts, and an Add to Calendar file",
        ],
      },
      {
        heading: "Choose a style",
        body: [
          "If you already know the look you want, start there: [floral wedding invitation templates](/wedding-invitations/floral) for roses and blossom, [royal wedding invitation templates](/wedding-invitations/royal) for palaces and gold, [minimal wedding invitation templates](/wedding-invitations/minimal) for a quieter card, or [Indian wedding invitations](/wedding-invitations/indian) with temple, mandap and marigold designs. Planning a Kerala wedding? See [Kerala wedding invitations](/india/kerala).",
        ],
      },
      {
        heading: "RSVP, music and sharing",
        body: [
          "Guests reply on the invitation itself. You decide what to ask: guest count, meal choice, a phone number or your own questions. Read more about [wedding invitations with RSVP](/features/rsvp).",
          "Add one of the built-in tracks or your own file. It never plays until the guest taps, and they can mute it ([wedding invitations with music](/features/music)).",
          "Share on WhatsApp, by email, by link or with a [QR code](/features/qr-code). Give each family a [personal link](/features/personal-links) and you can [track who has replied](/features/guest-tracking).",
        ],
      },
    ],
    related: ["/nikah-invitations", "/engagement-invitations", "/wedding-invitations/floral", "/wedding-invitations/royal", "/wedding-invitations/minimal", "/wedding-invitations/indian", "/features/rsvp", "/features/music", "/guides/how-to-create-a-digital-wedding-invitation"],
    faq: [
      { q: "Do guests need an account or an app?", a: "No. Guests open the link in their browser and can reply straight away." },
      { q: "How much does it cost?", a: `Every design costs ${PRICE_LABEL}, paid once when you publish. Previewing and customizing are free.` },
      { q: "Can I change the design later?", a: "Yes. In the editor you can switch to any other design and keep everything you have written." },
      { q: "Can I send it on WhatsApp?", a: "Yes. Once published you get a link, a ready-to-send WhatsApp message and a QR code." },
    ],
    schemaType: "CollectionPage",
    crumbs: [{ href: "/wedding-invitations", label: "Wedding Invitations" }],
    updated: UPDATED,
  },
  {
    id: "nikah",
    type: "occasion",
    path: "/nikah-invitations",
    title: "Nikah Invitations Online | Animated Digital Invitations | YoureIn",
    h1: "Nikah Invitations, Made to Be Opened",
    description:
      "Animated digital Nikah invitations with RSVP, venue maps, music and personal guest links, shared on WhatsApp. Preview YoureIn Nikah designs online.",
    intro:
      "Moons, lanterns, palaces and night skies: the Nikah designs are drawn around architecture and light rather than figures. Add the Nikah, the reception and any other function, and let guests reply for each.",
    searchIntent: "Commercial: someone looking for a digital Nikah invitation or Muslim wedding invitation online.",
    primaryKeyword: "nikah invitation online",
    secondaryKeywords: ["muslim wedding invitation", "digital nikah invitation", "islamic wedding invitation", "online nikah card"],
    templates: { by: "category", category: "Nikah" },
    minTemplates: 3,
    occasion: "nikah",
    benefits: [
      { title: "Every function on one page", text: "List the Nikah, the reception and any other gathering, each with its own time, place and dress code." },
      { title: "Reply for each function", text: "Guests can say how many will come to each function, so the numbers for each gathering are clear." },
      { title: "Easy for family to share", text: "A single link works well in family WhatsApp groups, and each family can have a personal link." },
    ],
    sections: [
      {
        heading: "Designs for a Nikah",
        body: [
          "These four designs are chosen for Nikah ceremonies. [Jasmine Moon](/templates/jasmine-moon) was drawn for the occasion; [Moonlit Mahal](/templates/moonlit-mahal), [Royal Emerald](/templates/royal-emerald) and [Celestial Veil](/templates/celestial-veil) work equally well for a Nikah or a wedding. All four are dark, with a gold accent, and suit an evening ceremony.",
        ],
      },
      {
        heading: "What you can put on the invitation",
        body: ["Set up the day the way your family will hold it."],
        bullets: [
          "The Nikah and the reception as separate events, each with time, venue and a Google Maps link",
          "A dress code for any event",
          "Private events shown only to the families you choose",
          "Your message, a photograph and a gallery",
          "Optional music that only plays when a guest taps, and that they can mute",
        ],
      },
      {
        heading: "Replies, maps and sharing",
        body: [
          "Guests reply on the invitation and tell you how many are coming. You see every reply on one dashboard ([wedding invitations with RSVP](/features/rsvp)). The venue opens directly in Maps, and a calendar file adds the date to the guest's phone.",
          "Share on WhatsApp in one tap, or give each family a [personal link](/features/personal-links) so you know who has replied.",
        ],
      },
      HOW_IT_WORKS,
    ],
    related: ["/wedding-invitations", "/features/rsvp", "/features/multiple-events", "/features/personal-links", "/wedding-invitations/royal", "/guides/how-to-create-a-nikah-invitation-online"],
    faq: [
      { q: "Can I list the Nikah and the reception separately?", a: "Yes. Add each function as its own event with its own time, place and dress code, and let guests reply for each." },
      { q: "Can some functions be private?", a: "Yes. You can mark an event as private so only the guests whose personal link includes it can see it." },
      { q: "Does music have to play?", a: "No. Music is optional, never plays before a guest taps, and guests can mute it at any time." },
    ],
    schemaType: "CollectionPage",
    crumbs: [{ href: "/nikah-invitations", label: "Nikah Invitations" }],
    updated: UPDATED,
  },
  {
    id: "engagement",
    type: "occasion",
    path: "/engagement-invitations",
    title: "Engagement Invitations Online | Animated Designs | YoureIn",
    h1: "Engagement Invitations That Feel Like a Gift",
    description:
      "Animated digital engagement invitations with RSVP, countdown and venue directions. Four soft designs, shared in one link. Preview YoureIn engagement templates.",
    intro:
      "Roses, blossom, a satin bow and a flower swing: four lighter designs for an engagement. They keep the details clear and the mood gentle, and they also work for a small wedding.",
    searchIntent: "Commercial: someone looking for an online engagement invitation.",
    primaryKeyword: "engagement invitation online",
    secondaryKeywords: ["digital engagement invitation", "engagement invitation card online", "animated engagement invitation"],
    templates: { by: "category", category: "Engagement" },
    minTemplates: 3,
    occasion: "engagement",
    benefits: [
      { title: "Soft, light designs", text: "Pinks, creams and greens rather than heavy gold, for an occasion that is warm rather than grand." },
      { title: "Everything guests need", text: "Date, venue with directions, a countdown and an RSVP, all on one page." },
      { title: "Ready to be reused", text: "Switch design later without retyping anything, for example when the wedding invitation follows." },
    ],
    sections: [
      {
        heading: "Choosing an engagement design",
        body: [
          "[Rose Garden](/templates/rose-garden) and [Garden Swing](/templates/garden-swing) suit a garden or outdoor party. [Cherry Blossom](/templates/cherry-blossom) is the cleanest of the four, with the details front and centre. [Silk Ribbon](/templates/silk-ribbon) is the most gift-like: a satin bow that loosens as the guest opens it.",
        ],
      },
      {
        heading: "What guests see",
        body: ["Every design includes the same features."],
        bullets: [
          "Your names, the date and a message from the hosts",
          "The event with time and place, and directions in Maps",
          "A live countdown to the day",
          "RSVP with guest counts, and an Add to Calendar file",
        ],
      },
      HOW_IT_WORKS,
    ],
    related: ["/wedding-invitations", "/wedding-invitations/floral", "/wedding-invitations/minimal", "/features/rsvp", "/features/countdown"],
    faq: [
      { q: "Can I use an engagement design for the wedding too?", a: "Yes. These designs are also listed under weddings, and you can switch design in the editor without losing your details." },
      { q: "Can guests reply from their phones?", a: "Yes. The invitation is built for phones, and guests reply on the same page." },
    ],
    schemaType: "CollectionPage",
    crumbs: [{ href: "/engagement-invitations", label: "Engagement Invitations" }],
    updated: UPDATED,
  },
];

type StyleCopy = {
  id: StyleId;
  title: string;
  h1: string;
  description: string;
  intro: string;
  primary: string;
  secondary: string[];
  intent: string;
  sections: SeoPage["sections"];
  related: string[];
  faq?: SeoPage["faq"];
  crumb: string;
};

const STYLES: StyleCopy[] = [
  {
    id: "floral",
    title: "Floral Wedding Invitation Templates | YoureIn",
    h1: "Floral Wedding Invitations",
    description: "Animated floral wedding invitation templates: roses, blossom, orchids and marigold. Compare six designs and preview each one online with YoureIn.",
    intro: "Six designs built around flowers, from soft blush roses to bright marigold garlands. Each opens in its own way, so the florals are part of the animation, not a backdrop.",
    primary: "floral wedding invitation templates",
    secondary: ["flower wedding invitation online", "rose wedding invitation", "blossom wedding invitation"],
    intent: "Style: someone who wants flowers on their wedding invitation.",
    sections: [
      {
        heading: "How the floral designs differ",
        body: [
          "[Rose Garden](/templates/rose-garden) is the romantic one: blush roses part to reveal an arched walk. [Cherry Blossom](/templates/cherry-blossom) is the lightest, with one branch and a few falling petals. [Garden Swing](/templates/garden-swing) is relaxed and outdoorsy. [Pearl Vellum](/templates/pearl-vellum) shows white orchids behind translucent vellum, and [Botanical Vow](/templates/botanical-vow) is all leaves, with no blooms. [Marigold Celebration](/templates/marigold-celebration) is the brightest, for Indian weddings with several functions.",
        ],
      },
      {
        heading: "Who this style suits",
        body: [
          "Garden and daytime weddings, engagements, and couples who want warmth rather than grandeur. If you want gold and architecture instead, look at [royal wedding invitations](/wedding-invitations/royal). For a quieter card with fewer decorations, see [minimal wedding invitations](/wedding-invitations/minimal).",
        ],
      },
    ],
    related: ["/wedding-invitations", "/wedding-invitations/minimal", "/wedding-invitations/indian", "/engagement-invitations", "/features/photo-gallery"],
    crumb: "Floral",
  },
  {
    id: "royal",
    title: "Royal Wedding Invitation Templates | YoureIn",
    h1: "Royal Wedding Invitations",
    description: "Animated royal wedding invitation templates with palaces, arches and gold. Three grand designs for large celebrations. Preview each online with YoureIn.",
    intro: "Three designs that open on a palace: a moonlit mahal beside still water, emerald doors swinging onto arches of gold, and gilded gates in the afternoon sun.",
    primary: "royal wedding invitation templates",
    secondary: ["palace wedding invitation online", "royal digital wedding invitation", "gold wedding invitation"],
    intent: "Style: someone who wants a grand, palace-style wedding invitation.",
    sections: [
      {
        heading: "Night or day: which palace",
        body: [
          "[Moonlit Mahal](/templates/moonlit-mahal) and [Royal Emerald](/templates/royal-emerald) are dark, with gold lettering, and suit an evening ceremony or reception. [Golden Palace](/templates/golden-palace) is the daylit one: warm ivory and gold in full sun, which feels more festive and less hushed.",
        ],
      },
      {
        heading: "Who this style suits",
        body: [
          "Large family weddings and receptions, and celebrations where the setting is as important as the invitation. These designs also work well for a Nikah ([Nikah invitations](/nikah-invitations)). For something softer, see [floral wedding invitations](/wedding-invitations/floral).",
        ],
      },
    ],
    related: ["/wedding-invitations", "/nikah-invitations", "/wedding-invitations/indian", "/wedding-invitations/floral", "/features/multiple-events"],
    crumb: "Royal",
  },
  {
    id: "minimal",
    title: "Minimal Wedding Invitation Templates | YoureIn",
    h1: "Minimal Wedding Invitations",
    description: "Animated minimal wedding invitation templates: a wax seal, a satin ribbon, vellum and watercolour leaves. Four quiet designs to preview online with YoureIn.",
    intro: "Four designs where the paper does the work: an envelope with a wax seal, a satin bow, a sheet of vellum and a card framed in leaves. Fewer decorations, more space for your details.",
    primary: "minimal wedding invitation templates",
    secondary: ["simple wedding invitation online", "modern wedding invitation", "elegant wedding invitation"],
    intent: "Style: someone who wants a simple, modern or elegant wedding invitation.",
    sections: [
      {
        heading: "Four ways to open a quiet card",
        body: [
          "[Ivory Wax Seal](/templates/ivory-wax-seal) is the closest to a printed invitation. [Silk Ribbon](/templates/silk-ribbon) is the most gift-like. [Pearl Vellum](/templates/pearl-vellum) is airy and pale, and [Botanical Vow](/templates/botanical-vow) is quiet and green.",
        ],
      },
      {
        heading: "Who this style suits",
        body: [
          "Couples who like a restrained look, small and intimate weddings, and anyone who wants the names and details to stay in front. If you would like more atmosphere, compare [royal wedding invitations](/wedding-invitations/royal) or [floral wedding invitations](/wedding-invitations/floral).",
        ],
      },
    ],
    related: ["/wedding-invitations", "/wedding-invitations/floral", "/wedding-invitations/royal", "/engagement-invitations", "/features/qr-code"],
    crumb: "Minimal",
  },
  {
    id: "indian",
    title: "Indian Wedding Invitation Templates | YoureIn",
    h1: "Indian Wedding Invitations",
    description: "Animated Indian digital wedding invitations with mandap, temple and palace designs, several functions and RSVP. Preview five designs online with YoureIn.",
    intro: "Five designs that feel at home at an Indian wedding: a mandap behind marigold garlands, a South Indian temple gate, a Kerala doorway, and two palace designs in gold.",
    primary: "indian wedding invitation online",
    secondary: ["indian digital wedding invitation", "digital wedding invitation india", "premium digital wedding invitation india", "indian wedding card online"],
    intent: "Style and market: someone looking for an Indian-style digital wedding invitation.",
    sections: [
      {
        heading: "Designs by tradition and region",
        body: [
          "[Marigold Celebration](/templates/marigold-celebration) is the festive choice, with a mandap, lamps and flower strings. [Temple Heritage](/templates/temple-heritage) and [Kerala Ivory](/templates/kerala-ivory) are drawn for South Indian and Kerala weddings (see [Kerala wedding invitations](/india/kerala)). [Golden Palace](/templates/golden-palace) and [Royal Emerald](/templates/royal-emerald) bring palace gold for a grand wedding.",
        ],
      },
      {
        heading: "Built for weddings with many functions",
        body: [
          "Indian weddings often run over several days. Add each function as its own event with a time, a place and a dress code, mark some as private, and let guests reply for each one ([wedding invitations with multiple events](/features/multiple-events)).",
        ],
      },
    ],
    related: ["/wedding-invitations", "/india/kerala", "/wedding-invitations/royal", "/wedding-invitations/floral", "/features/multiple-events", "/features/guest-tracking"],
    crumb: "Indian",
  },
];

export const STYLE_PAGES: SeoPage[] = STYLES.map((s) => ({
  id: `style-${s.id}`,
  type: "style",
  path: `/wedding-invitations/${s.id}`,
  title: s.title,
  h1: s.h1,
  description: s.description,
  intro: s.intro,
  searchIntent: s.intent,
  primaryKeyword: s.primary,
  secondaryKeywords: s.secondary,
  templates: { by: "style", style: s.id },
  minTemplates: 3,
  style: s.id,
  sections: s.sections,
  related: s.related,
  faq: s.faq,
  schemaType: "CollectionPage",
  crumbs: [
    { href: "/wedding-invitations", label: "Wedding Invitations" },
    { href: `/wedding-invitations/${s.id}`, label: s.crumb },
  ],
  updated: UPDATED,
}));

type FeatureCopy = {
  id: FeatureId;
  title: string;
  h1: string;
  description: string;
  intro: string;
  primary: string;
  secondary: string[];
  intent: string;
  /** Designs that suit this feature, shown on the page. */
  templates: string[];
  /** Real screenshot of the feature, in public/features/. */
  image?: { src: string; alt: string; width: number; height: number };
  benefits: { title: string; text: string }[];
  sections: SeoPage["sections"];
  related: string[];
  faq: NonNullable<SeoPage["faq"]>;
  crumb: string;
};

const FEATURES: FeatureCopy[] = [
  {
    id: "rsvp",
    title: "Wedding Invitations with RSVP | YoureIn",
    h1: "Wedding Invitations with Built-In RSVP",
    description: "Wedding invitations where guests reply on the invitation itself: yes, maybe or no, guest counts, meal choices and replies for each function. See how it works.",
    intro: "The reply form is part of the invitation. Guests answer without calling anyone, and you see every response, with headcounts, in one place.",
    primary: "wedding invitation with rsvp",
    secondary: ["online rsvp wedding invitation", "rsvp for wedding online", "digital invitation with rsvp"],
    intent: "Feature: someone who wants guests to reply online.",
    templates: ["rose-garden", "silk-ribbon", "velvet-opera"],
    benefits: [
      { title: "Counts, not just yes or no", text: "Guests say how many are coming, so your total attending is a real number." },
      { title: "A reply for each function", text: "Turn on per-event RSVP and guests give a number for every function they can see." },
      { title: "Your own questions", text: "Ask for a meal preference or a phone number, or add up to six questions of your own." },
    ],
    sections: [
      {
        heading: "What guests can tell you",
        body: ["You choose what the reply form asks. Everything below is optional except the answer itself."],
        bullets: [
          "Yes, no, or maybe (you can switch maybe off)",
          "How many people are coming",
          "How many will attend each function, with per-event RSVP",
          "A meal preference and a phone number, if you ask for them",
          "Answers to up to six questions you write: text, yes or no, or one choice",
          "A message for the hosts",
        ],
      },
      {
        heading: "What you see as the host",
        body: [
          "The host dashboard lists every reply with the guest's name, answer and headcount, and totals the people attending. You can set a last day to reply and close RSVPs when you are done. Replies can be exported for your caterer or planner.",
          "The public invitation never shows other guests, totals or replies. To know exactly who has not answered yet, give each family a [personal link](/features/personal-links) and use [guest tracking](/features/guest-tracking).",
        ],
      },
      {
        heading: "Designs that show it well",
        body: ["The RSVP takes the look of the design. In [Velvet Opera](/templates/velvet-opera) it is styled as a theatre ticket."],
      },
    ],
    related: ["/features/guest-tracking", "/features/personal-links", "/features/multiple-events", "/wedding-invitations", "/guides/how-wedding-rsvp-tracking-works"],
    faq: [
      { q: "Do guests need an account to reply?", a: "No. They open the link and reply on the page." },
      { q: "Can guests change their reply?", a: "Replies from a personal link are tied to that family, so a later reply updates the earlier one." },
      { q: "Can I stop taking replies?", a: "Yes. You can set a last day to reply and close RSVPs from the dashboard." },
    ],
    crumb: "RSVP",
  },
  {
    id: "music",
    title: "Wedding Invitations with Music | YoureIn",
    h1: "Wedding Invitations with Music",
    description: "Add background music to your digital wedding invitation: ten built-in tracks or your own file. It plays only when a guest taps, and guests can mute it.",
    intro: "A song can set the whole mood of an invitation. Choose a track from the library or upload your own, and it plays softly when your guest opens the invitation.",
    primary: "wedding invitation with music",
    secondary: ["digital invitation with background music", "wedding invitation with song", "online invitation with music"],
    intent: "Feature: someone who wants music on their invitation.",
    templates: ["moonlit-mahal", "jasmine-moon", "kerala-ivory"],
    benefits: [
      { title: "Never a surprise", text: "Music does not play until the guest taps, and it fades in rather than starting loudly." },
      { title: "Guests stay in control", text: "A mute button is always on the page, and the music loops quietly in the background." },
      { title: "A library or your own", text: "Choose from the built-in tracks, or upload your own file." },
    ],
    sections: [
      {
        heading: "Choose a track",
        body: [
          "The built-in library has ten tracks, grouped by mood: romantic, elegant, traditional, cinematic and minimal. Each design suggests a few that suit it. You can preview each track in the editor before choosing.",
          "Prefer your own song? Upload an MP3, M4A, AAC or WAV file up to 4 MB. Make sure you have the right to use it.",
        ],
      },
      {
        heading: "How the music behaves",
        body: ["Music is built to be polite."],
        bullets: [
          "It never plays before the guest taps",
          "It fades in over a couple of seconds, including on iPhone",
          "It loops, and a mute button stays on the page",
          "You set the volume: low, medium or high",
          "You can choose whether it starts when the invitation opens or only when the guest chooses",
        ],
      },
    ],
    related: ["/features/countdown", "/features/photo-gallery", "/wedding-invitations", "/nikah-invitations"],
    faq: [
      { q: "Will music play automatically?", a: "Only after the guest's first tap. Browsers do not allow sound before that, and we never try to." },
      { q: "Can I use any song?", a: "You can upload your own file, but only use music you have the right to use." },
      { q: "Is music required?", a: "No. You can choose no music at all." },
    ],
    crumb: "Music",
  },
  {
    id: "guest-tracking",
    title: "Wedding Invitations with Guest Tracking | YoureIn",
    h1: "Wedding Invitations with Guest Tracking",
    description: "Keep a guest list, give each family a personal link and see who has replied and how many are coming, all from one wedding invitation dashboard.",
    intro: "Know who has been sent the invitation, who has replied and how many people are coming, without a spreadsheet and without chasing messages.",
    primary: "wedding invitation with guest tracking",
    secondary: ["wedding guest attendance tracking", "track rsvp wedding", "wedding guest list manager online"],
    intent: "Feature: someone who wants to track replies and attendance.",
    templates: ["royal-emerald", "golden-palace", "marigold-celebration"],
    benefits: [
      { title: "One guest list", text: "Add families or guests, each with a name and a personal link." },
      { title: "Replies by family", text: "Every reply shows next to the family it came from, with the number attending." },
      { title: "Totals that add up", text: "The total attending is the sum of the people in every yes reply, which is not the same as the number of replies." },
    ],
    sections: [
      {
        heading: "What you can see",
        body: ["The guest list and the replies sit together on the host dashboard."],
        bullets: [
          "Each family's name and personal link",
          "Whether you have sent them the invitation",
          "Their reply (yes, maybe or no) and how many are coming",
          "Total people attending, with guests who have not replied yet easy to spot",
          "How many times the invitation has been opened",
        ],
      },
      {
        heading: "Why personal links make it work",
        body: [
          "With a single shared link you only know the names guests type in. With a [personal link](/features/personal-links) for each family, every reply is already tied to the right household, and you can turn a link off if it was shared by mistake. Each family can also have a [QR code](/features/qr-code).",
        ],
      },
    ],
    related: ["/features/rsvp", "/features/personal-links", "/features/qr-code", "/wedding-invitations", "/guides/how-wedding-rsvp-tracking-works"],
    faq: [
      { q: "Do I have to add every guest?", a: "No. You can share one general link, or add families to get personal links and clearer tracking." },
      { q: "Can other guests see replies?", a: "No. A guest only sees the invitation. Replies, totals and other guests are visible only to you." },
    ],
    crumb: "Guest Tracking",
  },
  {
    id: "personal-links",
    title: "Wedding Invitations with Personalized Guest Links | YoureIn",
    h1: "Personalized Wedding Invitation Links",
    description: "Give every family their own wedding invitation link. Replies are tied to the right household, private events stay private and a link can be switched off.",
    intro: "Instead of one link for everybody, each family gets a link of its own. It opens the same invitation, but the reply, and any private events, belong to that family.",
    primary: "personalized wedding invitation link",
    secondary: ["personal wedding invitation link for each guest", "unique link wedding invitation", "wedding invitation with personalized guest links"],
    intent: "Feature: someone who wants a separate link for each guest or family.",
    templates: ["ivory-wax-seal", "temple-heritage", "garden-swing"],
    benefits: [
      { title: "Replies know who they are from", text: "A reply from a personal link is saved against that family automatically." },
      { title: "Private functions stay private", text: "Show a smaller event, such as a family dinner, only to the families you choose." },
      { title: "You stay in control", text: "Turn a link off at any time. The page then says so, and replies from it are refused." },
    ],
    sections: [
      {
        heading: "How it works",
        body: ["Add a family to your guest list and the invitation gives them a link. Send it on WhatsApp, by email or as a [QR code](/features/qr-code). When they open it, they see the invitation, and any private events you have given them."],
        bullets: [
          "One link per family, created for you",
          "Replies and wishes from the link are saved against that family",
          "Private events appear only for the guests who have them",
          "A link can be turned off if it was shared with the wrong people",
        ],
      },
      {
        heading: "When to use one link and when to use many",
        body: [
          "A single shared link is quickest for a small gathering. Personal links are better when the guest list is large, when functions differ between families, or when you need to know exactly who has not replied. They also feed [guest tracking](/features/guest-tracking).",
        ],
      },
    ],
    related: ["/features/guest-tracking", "/features/qr-code", "/features/rsvp", "/features/multiple-events", "/wedding-invitations"],
    faq: [
      { q: "What if a personal link is forwarded?", a: "It still opens the invitation. You can turn that link off from the guest list if you want to stop replies from it." },
      { q: "Can everyone still use one common link?", a: "Yes. Every invitation also has a general link." },
    ],
    crumb: "Personalized Links",
  },
  {
    id: "qr-code",
    title: "Wedding Invitations with QR Code | YoureIn",
    h1: "Wedding Invitations with a QR Code",
    description: "Every family gets a QR code for their invitation, and you can download a phone-sized invitation picture with a QR code to print or share. See how it works.",
    intro: "A QR code takes guests straight to the invitation, with no typing. Use it on a printed card, a poster at the venue or a WhatsApp image.",
    primary: "wedding invitation with qr code",
    secondary: ["qr code wedding invitation india", "qr code for wedding invitation link", "digital invitation qr code"],
    intent: "Feature: someone who wants a QR code that opens their invitation.",
    templates: ["botanical-vow", "pearl-vellum", "cherry-blossom"],
    benefits: [
      { title: "A code for every family", text: "In the guest list each family has a QR code for their personal link." },
      { title: "An invitation picture", text: "Download a phone-sized picture of your invitation with a QR code, to share as an image." },
      { title: "Bridge print and digital", text: "Add the code to a printed card so older relatives can open the animated invitation too." },
    ],
    sections: [
      {
        heading: "Where QR codes help",
        body: ["Most guests will open the link from WhatsApp. A QR code is for everything else."],
        bullets: [
          "Printed cards that also point to the animated invitation",
          "Signs and posters at the venue or at the entrance of a function",
          "Image invitations sent as a picture",
          "Guests who are sitting next to each other and would rather scan than type",
        ],
      },
      {
        heading: "Combined with personal links",
        body: ["The code for a family's [personal link](/features/personal-links) opens their own invitation and ties their reply to them. Read more on [guest tracking](/features/guest-tracking)."],
      },
    ],
    related: ["/features/personal-links", "/features/guest-tracking", "/wedding-invitations", "/guides/how-to-share-wedding-invitations-on-whatsapp"],
    faq: [
      { q: "Does the QR code expire?", a: "It opens your invitation link, so it works as long as the invitation is published." },
      { q: "Can I print it?", a: "Yes. Download the invitation picture with the QR code and print it, or add the code to a card." },
    ],
    crumb: "QR Code",
  },
  {
    id: "photo-gallery",
    title: "Wedding Invitations with Photo Gallery | YoureIn",
    h1: "Wedding Invitations with a Photo Gallery",
    description: "Add your own photographs to your digital wedding invitation: a main portrait and a gallery of up to eight pictures. See how it looks on YoureIn designs.",
    intro: "Your photographs sit inside the design: a portrait beside your story and a gallery guests can look through, framed in the shape that suits the design.",
    primary: "wedding invitation with photo gallery",
    secondary: ["digital wedding invitation with photos", "wedding invitation with couple photo", "online invitation photo gallery"],
    intent: "Feature: someone who wants to show photographs on their invitation.",
    templates: ["scenic-romance", "rose-garden", "cherry-blossom"],
    benefits: [
      { title: "A portrait and a gallery", text: "One main photograph and up to eight in the gallery." },
      { title: "Framed by the design", text: "Frames follow the design, from arches to ovals, so photos look as if they belong." },
      { title: "Light on the phone", text: "Photos are shrunk in your browser before upload, so the invitation stays quick to open." },
    ],
    sections: [
      {
        heading: "What you can add",
        body: ["Upload from your phone or computer in the editor."],
        bullets: [
          "A main photograph of the couple, next to your story",
          "A gallery of up to eight pictures",
          "Optional guest photographs shared with wishes, once the guestbook is on",
        ],
      },
      {
        heading: "Choosing photographs",
        body: [
          "Portrait photos work best for the main picture. For the gallery, mix close-ups and wider shots, and choose pictures that are sharp even when small. Each design crops frames its own way, so the preview in the editor shows exactly how yours will look.",
        ],
      },
    ],
    related: ["/features/countdown", "/features/music", "/wedding-invitations", "/wedding-invitations/floral"],
    faq: [
      { q: "How many photographs can I add?", a: "A main photograph and up to eight pictures in the gallery." },
      { q: "Will large photos slow the invitation down?", a: "Photos are resized in your browser before they upload, which keeps the page quick." },
    ],
    crumb: "Photo Gallery",
  },
  {
    id: "countdown",
    title: "Wedding Invitations with Countdown | YoureIn",
    h1: "Wedding Invitations with a Live Countdown",
    description: "A live countdown to your wedding day on your digital invitation, with the date, venue directions and an Add to Calendar file. See it on YoureIn designs.",
    intro: "Days, hours and minutes to your ceremony, ticking on the invitation itself. It is on by default and can be switched off.",
    primary: "wedding invitation with countdown",
    secondary: ["digital invitation countdown timer", "wedding countdown invitation online"],
    intent: "Feature: someone who wants a countdown timer on their invitation.",
    templates: ["celestial-veil", "golden-palace", "scenic-romance"],
    benefits: [
      { title: "Counts to your ceremony", text: "The countdown runs to the time of your main ceremony, in the time zone of the event." },
      { title: "Sits beside the useful details", text: "Date, venue, directions and Add to Calendar are close by." },
      { title: "Yours to switch off", text: "If you would rather not show it, turn it off in the editor." },
    ],
    sections: [
      {
        heading: "What the countdown does",
        body: [
          "It reads the date and time you enter for the main ceremony and counts down to it. After the event the countdown is no longer needed, and the invitation can be turned into a thank-you page.",
        ],
      },
      {
        heading: "Pair it with the practical details",
        body: [
          "Guests can open the venue in Maps and add the date to their calendar from the same page. Add [several events](/features/multiple-events) if the celebration runs over more than one day.",
        ],
      },
    ],
    related: ["/features/multiple-events", "/features/rsvp", "/wedding-invitations", "/features/photo-gallery"],
    faq: [
      { q: "Which event does it count to?", a: "The date and time of your main ceremony." },
      { q: "Can I turn it off?", a: "Yes. It is a switch in the editor." },
    ],
    crumb: "Countdown",
  },
  {
    id: "multiple-events",
    title: "Wedding Invitations with Multiple Events | YoureIn",
    h1: "Wedding Invitations with Multiple Events",
    description: "Put every function on one wedding invitation: each with its own time, place and dress code, private events for chosen guests and a reply for each.",
    intro: "Mehendi, sangeet, the ceremony and the reception can all live on one invitation, each with its own time, venue and dress code.",
    primary: "wedding invitation with multiple events",
    secondary: ["wedding invitation multiple functions", "indian wedding invitation with several events", "wedding schedule invitation online"],
    intent: "Feature: someone planning a wedding with several functions.",
    templates: ["marigold-celebration", "temple-heritage", "kerala-ivory"],
    benefits: [
      { title: "A page for every function", text: "Each event has a title, day, time, venue and an optional note and dress code." },
      { title: "Private functions", text: "Show an event only to the guests whose personal link includes it." },
      { title: "A reply for each", text: "Guests tell you how many are coming to each function they can see." },
    ],
    sections: [
      {
        heading: "Setting up your functions",
        body: ["Add events one by one in the editor, in the order they will happen."],
        bullets: [
          "Title, day and time, and the place",
          "A short note, for example parking or what to bring",
          "A dress code",
          "A private switch for events that only some guests should see",
        ],
      },
      {
        heading: "How guests reply",
        body: [
          "With per-event [RSVP](/features/rsvp), guests give a number for each function they can see. The invitation records the largest of those as the family's headcount, and the dashboard shows each reply's number for every function.",
          "Pair it with [personal links](/features/personal-links) so each family sees exactly the functions they are invited to.",
        ],
      },
    ],
    related: ["/features/rsvp", "/features/personal-links", "/wedding-invitations/indian", "/nikah-invitations"],
    faq: [
      { q: "Can some guests see fewer events?", a: "Yes. Mark an event private and only guests whose personal link includes it can see it." },
      { q: "Is there a limit on events?", a: "You can add up to eight functions to one invitation." },
    ],
    crumb: "Multiple Events",
  },
];

export const FEATURE_PAGES: SeoPage[] = FEATURES.map((f) => ({
  id: `feature-${f.id}`,
  type: "feature" as const,
  path: `/features/${f.id}`,
  title: f.title,
  h1: f.h1,
  description: f.description,
  intro: f.intro,
  searchIntent: f.intent,
  primaryKeyword: f.primary,
  secondaryKeywords: f.secondary,
  templates: { by: "slugs" as const, slugs: f.templates },
  minTemplates: 3,
  feature: f.id,
  benefits: f.benefits,
  sections: f.sections,
  related: f.related,
  faq: f.faq,
  image: f.image?.src,
  schemaType: "WebPage" as const,
  crumbs: [
    { href: "/features", label: "Features" },
    { href: `/features/${f.id}`, label: f.crumb },
  ],
  updated: UPDATED,
}));

export const FEATURE_INDEX: SeoPage = {
  id: "features",
  type: "feature-index",
  path: "/features",
  title: "Digital Invitation Features | RSVP, Music, QR Codes | YoureIn",
  h1: "Everything a YoureIn Invitation Does",
  description: "RSVP, guest tracking, personal links, QR codes, music, photo gallery, countdown and multiple events: what every YoureIn digital invitation includes.",
  intro: "Every design has the same working parts. Here is what each one does and how to use it.",
  searchIntent: "Navigation: someone comparing what a digital invitation can do.",
  primaryKeyword: "digital invitation features",
  secondaryKeywords: ["wedding invitation features", "online invitation with rsvp and music"],
  templates: { by: "none" },
  minTemplates: 0,
  sections: [],
  related: FEATURE_PAGES.map((p) => p.path),
  schemaType: "CollectionPage",
  crumbs: [{ href: "/features", label: "Features" }],
  updated: UPDATED,
};

export const LOCATION_PAGES: SeoPage[] = [
  {
    id: "kerala",
    type: "location",
    path: "/india/kerala",
    title: "Kerala Wedding Invitations Online | Animated | YoureIn",
    h1: "Kerala Wedding Invitations",
    description: "Digital wedding invitations for Kerala: Kerala Ivory with kasavu gold and a tharavadu courtyard, and Temple Heritage with its gopuram. Preview them with YoureIn.",
    intro:
      "Two designs are drawn for Kerala: Kerala Ivory, in the ivory and gold of kasavu, and Temple Heritage, with a South Indian temple gate. Other designs on YoureIn work well too, and everything is customized with your own names and events.",
    searchIntent: "Location and style: someone planning a wedding in Kerala looking for a digital invitation.",
    primaryKeyword: "kerala wedding invitation online",
    secondaryKeywords: ["kerala digital wedding invitation", "south indian wedding invitation online", "kerala wedding card online"],
    templates: { by: "slugs", slugs: ["kerala-ivory", "temple-heritage"] },
    minTemplates: 2,
    location: "Kerala",
    sections: [
      {
        heading: "The two Kerala designs",
        body: [
          "[Kerala Ivory](/templates/kerala-ivory) takes its colours from kasavu, the gold-bordered ivory cloth of Kerala. A carved wooden door opens on a tharavadu courtyard under coconut palms, with lamps lit and jasmine strung overhead. It is gentle and rooted in a place.",
          "[Temple Heritage](/templates/temple-heritage) opens carved temple gates onto a gopuram, with brass lamps and banana leaves. It is a better fit for a temple wedding and for a South Indian feel more broadly.",
        ],
      },
      {
        heading: "Setting up a Kerala wedding day",
        body: [
          "Kerala weddings take many forms, across Hindu, Christian and Muslim families, and often include more than one gathering, such as an engagement, the wedding ceremony and a reception. Add each as its own event, each with its own time, venue and a Google Maps link, so guests travelling from elsewhere in Kerala or abroad have everything on one page. See [wedding invitations with multiple events](/features/multiple-events).",
          "Families often need to reach a wide circle of relatives. Share the invitation on WhatsApp, and use [personal links](/features/personal-links) so each household's reply comes back to you under its own name.",
        ],
      },
      {
        heading: "Other designs that suit a Kerala wedding",
        body: [
          "Some Kerala couples prefer a lighter or a more modern look. [Pearl Vellum](/templates/pearl-vellum) and [Ivory Wax Seal](/templates/ivory-wax-seal) work well in ivory and gold, and [Marigold Celebration](/templates/marigold-celebration) is a lively choice for a multi-day celebration. Browse all [Indian wedding invitations](/wedding-invitations/indian).",
        ],
      },
    ],
    related: ["/wedding-invitations/indian", "/wedding-invitations", "/features/multiple-events", "/features/personal-links", "/wedding-invitations/minimal"],
    faq: [
      { q: "Is the invitation written in English?", a: "You write your own text in the editor, and the designs use Latin-script lettering for names and headings." },
      { q: "Can guests abroad open it?", a: "Yes. It is a web link, so it opens on any phone or computer with internet access." },
    ],
    schemaType: "CollectionPage",
    crumbs: [
      { href: "/wedding-invitations", label: "Wedding Invitations" },
      { href: "/india/kerala", label: "Kerala" },
    ],
    updated: UPDATED,
  },
];

export const TRUST_PAGES: SeoPage[] = [
  {
    id: "about",
    type: "trust",
    path: "/about",
    title: "About YoureIn | Animated Digital Invitations",
    h1: "About YoureIn",
    description: "YoureIn makes animated digital invitations for weddings, Nikah and engagements, with RSVP and guest tracking. Learn what we make and how it works.",
    intro: "YoureIn is a service for making animated digital invitations: pick a design, make it yours, share one link and see who is coming.",
    searchIntent: "Trust: who is behind the site and what it sells.",
    primaryKeyword: "about yourein",
    secondaryKeywords: [],
    templates: { by: "none" },
    minTemplates: 0,
    sections: [
      {
        heading: "What we make",
        body: [
          `Every YoureIn invitation is an animated web page that opens like the real thing, with your names, events, venue, photographs and music, and an RSVP form guests can use. Each design costs ${PRICE_LABEL}, paid once when you publish.`,
          "The artwork is drawn in code, so it stays sharp on any screen.",
        ],
      },
      {
        heading: "What we do with your information",
        body: [
          "The details you enter belong to you and are used to show your invitation and manage replies. Guests only see the invitation, never other guests' replies. Read more in our [privacy policy](/privacy).",
        ],
      },
      {
        heading: "Get in touch",
        body: ["Questions about an invitation or a payment? See the [contact page](/contact)."],
      },
    ],
    related: ["/contact", "/privacy", "/terms", "/wedding-invitations"],
    schemaType: "AboutPage",
    crumbs: [{ href: "/about", label: "About" }],
    updated: UPDATED,
  },
  {
    id: "contact",
    type: "trust",
    path: "/contact",
    title: "Contact YoureIn | Help with Your Invitation",
    h1: "Contact YoureIn",
    description: "Contact YoureIn for help with an invitation, a payment or a question about our designs.",
    intro: "Questions about a design, an invitation or a payment? Reach us using the details below.",
    searchIntent: "Trust: how to reach the company.",
    primaryKeyword: "contact yourein",
    secondaryKeywords: [],
    templates: { by: "none" },
    minTemplates: 0,
    sections: [],
    related: ["/about", "/privacy", "/terms"],
    schemaType: "ContactPage",
    crumbs: [{ href: "/contact", label: "Contact" }],
    updated: UPDATED,
  },
  {
    id: "privacy",
    type: "trust",
    path: "/privacy",
    title: "Privacy Policy | YoureIn",
    h1: "Privacy Policy",
    description: "How YoureIn handles the details you enter, guest replies, photographs, sign-in and payments.",
    intro: "What we collect, why, and who sees it.",
    searchIntent: "Trust: how personal data is handled.",
    primaryKeyword: "yourein privacy policy",
    secondaryKeywords: [],
    templates: { by: "none" },
    minTemplates: 0,
    sections: [
      {
        heading: "What we collect",
        body: ["We collect only what the service needs to work."],
        bullets: [
          "Your account details: your name, email address and a password stored in hashed form, or a Google sign-in if you use it.",
          "What you add to an invitation: names, dates, venues, messages, photographs, music and your guest list.",
          "Replies and wishes that guests submit on your invitation: their name, answer, headcount and anything else you chose to ask for.",
          "Payment records: the payment reference and amount. Card details are handled by our payment provider and never stored by us.",
          "A count of views and taps (such as directions or calendar) on a published invitation. This count does not identify guests.",
        ],
      },
      {
        heading: "Who can see it",
        body: [
          "Guests who open your link see your invitation, and only your invitation. They never see other guests, totals or other replies. Replies, guest lists and statistics are visible only to the account that owns the invitation.",
          "Invitations that you publish are not listed on our website and are asked not to be indexed by search engines. Anyone who has the link can open the invitation, so share it only with people you want to invite.",
        ],
      },
      {
        heading: "Cookies",
        body: [
          "We use a sign-in cookie to keep you signed in and a small non-secret cookie that tells the page whether you are signed in. We do not use advertising cookies on the invitations your guests open.",
        ],
      },
      {
        heading: "Visitors without an account",
        body: ["If you customize a design before signing in, we create a temporary guest account for your draft. When you sign in your draft moves to your account. Drafts from temporary accounts that nobody returns to are deleted after 30 days."],
      },
      {
        heading: "Payments and email",
        body: [
          "Payments are processed by Razorpay. We receive confirmation of the payment, not your card or bank details. If a password reset email is sent, it goes through our email provider.",
        ],
      },
      {
        heading: "Your choices",
        body: [
          "You can change your account details in your account page and hide a published invitation to take its page offline. To ask us to delete your data, [contact us](/contact).",
        ],
      },
    ],
    related: ["/terms", "/about", "/contact"],
    schemaType: "WebPage",
    crumbs: [{ href: "/privacy", label: "Privacy" }],
    updated: UPDATED,
  },
  {
    id: "terms",
    type: "trust",
    path: "/terms",
    title: "Terms of Service | YoureIn",
    h1: "Terms of Service",
    description: "The terms for using YoureIn: what you pay, what you can publish, and what to expect from the service.",
    intro: "The short version of how YoureIn works, and what we ask of you.",
    searchIntent: "Trust: terms for using the service.",
    primaryKeyword: "yourein terms",
    secondaryKeywords: [],
    templates: { by: "none" },
    minTemplates: 0,
    sections: [
      {
        heading: "The service",
        body: [
          `YoureIn lets you create, publish and share an animated digital invitation. Creating and previewing are free. Publishing costs ${PRICE_LABEL} per invitation, paid once. An invitation is published only after the payment has been confirmed.`,
        ],
      },
      {
        heading: "Your content",
        body: [
          "You own what you add: your text, photographs, music and guest list. You confirm that you have the right to use it, including any music you upload, and that you have the permission of the people whose details you add.",
          "Do not use YoureIn to publish anything unlawful, abusive or misleading.",
        ],
      },
      {
        heading: "Payments and problems",
        body: [
          "Payments are handled by Razorpay. If a payment went wrong, for example you were charged but the invitation did not publish, [contact us](/contact) with the details and we will look into it.",
        ],
      },
      {
        heading: "Availability",
        body: ["We work to keep the service running, but we cannot promise it will always be available. Keep a copy of your guest list and replies, which you can export from your dashboard."],
      },
      {
        heading: "Changes",
        body: ["We may update these terms as the service changes. The date at the bottom of this page shows when they last changed."],
      },
    ],
    related: ["/privacy", "/about", "/contact"],
    schemaType: "WebPage",
    crumbs: [{ href: "/terms", label: "Terms" }],
    updated: UPDATED,
  },
];

export const GUIDE_INDEX: SeoPage = {
  id: "guides",
  type: "guide-index",
  path: "/guides",
  title: "Wedding Invitation Guides | YoureIn",
  h1: "Guides for Digital Invitations",
  description: "Practical guides on creating digital wedding and Nikah invitations, collecting RSVPs, and sharing invitations on WhatsApp.",
  intro: "Short, practical guides for the questions that come up when you plan a digital invitation.",
  searchIntent: "Informational hub: guides on digital invitations.",
  primaryKeyword: "wedding invitation guides",
  secondaryKeywords: [],
  templates: { by: "none" },
  minTemplates: 0,
  sections: [],
  related: ["/wedding-invitations", "/nikah-invitations", "/features/rsvp"],
  schemaType: "CollectionPage",
  crumbs: [{ href: "/guides", label: "Guides" }],
  updated: UPDATED,
};

export const HOME_PAGE: SeoPage = {
  id: "home",
  type: "home",
  path: "/",
  title: "YoureIn | Premium Animated Digital Invitations",
  h1: "Invitations worth opening.",
  description:
    "Create an animated digital invitation that opens like the real thing. Personalize it, share one link and track RSVPs. Wedding, Nikah and engagement designs.",
  intro: "",
  searchIntent: "Brand and broad commercial: digital invitations.",
  primaryKeyword: "digital invitations",
  secondaryKeywords: ["animated digital invitations", "online invitation maker india"],
  templates: { by: "none" },
  minTemplates: 0,
  sections: [],
  related: [],
  schemaType: "WebPage",
  crumbs: [],
  updated: UPDATED,
};

/** Every page except guide articles, which live in guides.ts. */
export const SEO_PAGES: SeoPage[] = [HOME_PAGE, ...OCCASION_PAGES, ...STYLE_PAGES, FEATURE_INDEX, ...FEATURE_PAGES, ...LOCATION_PAGES, GUIDE_INDEX, ...TRUST_PAGES];
