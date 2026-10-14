import { PRICE_LABEL } from "@/config/site";
import type { Faq, Section, SeoPage } from "./types";

/**
 * Editorial guides. Each one answers a real question completely and links to the product page
 * where the answer is something YoureIn does. Add guides slowly, one useful article at a time.
 * In body text, [label](/path) makes an internal link.
 */
export type Guide = {
  slug: string;
  title: string;
  h1: string;
  description: string;
  intro: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  sections: Section[];
  faq?: Faq[];
  related: string[];
  updated: string;
};

export const GUIDES: Guide[] = [
  {
    slug: "how-to-create-a-digital-wedding-invitation",
    title: "How to Create a Digital Wedding Invitation | YoureIn",
    h1: "How to Create a Digital Wedding Invitation",
    description: "A step-by-step guide to making a digital wedding invitation: what to prepare, how to choose a design, what to write, and how to share it with guests.",
    intro: "A digital invitation is a web page your guests open from a link. Here is how to go from nothing to a finished, shared invitation in one sitting, with a checklist of what to have ready.",
    primaryKeyword: "how to create a digital wedding invitation",
    secondaryKeywords: ["make a digital wedding invitation", "create online wedding invitation"],
    sections: [
      {
        heading: "1. Gather the details first",
        body: ["Collecting these before you start makes the rest take minutes."],
        bullets: [
          "Names of the couple, and the names of the hosts if you want them on the invitation",
          "The date and time of each function, and the venue and address for each",
          "A Google Maps link for each venue, so guests can navigate in one tap",
          "One portrait photograph, and a few for the gallery",
          "A short message, or the wording you want to use (see our guide on [what to include in a wedding invitation](/guides/what-to-include-in-a-wedding-invitation))",
          "The last date by which you would like replies",
        ],
      },
      {
        heading: "2. Choose a design that fits the day",
        body: [
          "Start with the mood rather than the details, because the details are easy to change. Browse [wedding invitations](/wedding-invitations) or jump to a style: [floral](/wedding-invitations/floral), [royal](/wedding-invitations/royal), [minimal](/wedding-invitations/minimal) or [Indian](/wedding-invitations/indian). Preview a few on your phone, since that is where most guests will see it, and pay attention to how each one opens.",
          "A design is not a commitment. In the editor you can switch to another design and keep everything you have written.",
        ],
      },
      {
        heading: "3. Customize it",
        body: [
          "In the editor you go step by step: names, date and venue, photographs, events, RSVP settings, and then the words, music and design. Your draft is saved as you go. You can preview the real invitation at any time.",
        ],
      },
      {
        heading: "4. Decide how guests reply",
        body: [
          "Switch on RSVP and choose what to ask. At minimum: yes, no, and how many people are coming. If your wedding has several functions, turn on per-event replies. See [wedding invitations with RSVP](/features/rsvp) for the options.",
        ],
      },
      {
        heading: "5. Publish and share",
        body: [
          `Publishing costs ${PRICE_LABEL} once and gives you a link. Open it yourself first, on your phone, and read every line. Then share it: see [how to share wedding invitations on WhatsApp](/guides/how-to-share-wedding-invitations-on-whatsapp) for a few tips. If you have a large guest list, create a [personal link for each family](/features/personal-links).`,
        ],
      },
    ],
    faq: [
      { q: "How long does it take?", a: "If you have the details ready, a first version takes a few minutes. Most of the time goes into choosing photographs and wording." },
      { q: "Can I edit after publishing?", a: "Yes. You can keep editing the invitation, for example to add a venue change, and guests see the latest version." },
    ],
    related: ["/wedding-invitations", "/features/rsvp", "/guides/what-to-include-in-a-wedding-invitation"],
    updated: "2026-10-14",
  },
  {
    slug: "what-to-include-in-a-wedding-invitation",
    title: "What to Include in a Wedding Invitation | YoureIn",
    h1: "What to Include in a Wedding Invitation",
    description: "A checklist of what a wedding invitation needs, from names and venue to RSVP details, and what to add to a digital invitation that a printed card cannot do.",
    intro: "A good invitation answers every question a guest would otherwise have to ask. This checklist covers the essentials, and what a digital invitation can add.",
    primaryKeyword: "what to include in a wedding invitation",
    secondaryKeywords: ["wedding invitation checklist", "wedding invitation details"],
    sections: [
      {
        heading: "The essentials",
        body: ["Every wedding invitation, printed or digital, should say:"],
        bullets: [
          "Who is getting married, and who is hosting",
          "The date, and the start time of each function",
          "The venue name and full address for each function",
          "How to reply, and by when",
          "Anything about dress or what to expect, such as an outdoor ceremony",
        ],
      },
      {
        heading: "What a digital invitation can add",
        body: ["These are the things a printed card has no room for."],
        bullets: [
          "A map link, so nobody has to type an address (see [wedding invitations with a countdown and directions](/features/countdown))",
          "An Add to Calendar file, so the date lands on guests' phones",
          "A separate entry for each function, with its own time, place and dress code ([multiple events](/features/multiple-events))",
          "A reply form that records how many are coming ([RSVP](/features/rsvp))",
          "Updates: if a time changes, edit it once and every guest sees the new version",
        ],
      },
      {
        heading: "What to leave out",
        body: [
          "Skip long schedules for the whole weekend on the main page, gift registry details that read as demands, and anything you would not say aloud to a guest. Keep private details, such as a small family dinner, for the guests who need them, using [private events and personal links](/features/personal-links).",
        ],
      },
      {
        heading: "A note on wording",
        body: [
          "Use the voice of whoever is inviting: the hosts, the couple, or both families together. Keep it short. Guests read an invitation on a phone, standing up, so lead with the date and the place.",
        ],
      },
    ],
    related: ["/guides/how-to-create-a-digital-wedding-invitation", "/wedding-invitations", "/features/multiple-events"],
    updated: "2026-10-14",
  },
  {
    slug: "how-wedding-rsvp-tracking-works",
    title: "How Wedding RSVP Tracking Works | YoureIn",
    h1: "How Wedding RSVP Tracking Works",
    description: "How to collect and track wedding RSVPs online: what to ask, why personal links help, how headcounts add up, and how to chase the families who have not replied.",
    intro: "RSVP tracking is mostly about two numbers: who has replied, and how many people that means. Here is how to get both reliably.",
    primaryKeyword: "how wedding rsvp tracking works",
    secondaryKeywords: ["track wedding rsvp", "wedding guest attendance tracking"],
    sections: [
      {
        heading: "What an online RSVP collects",
        body: [
          "A reply form on the invitation records each guest's name, whether they are coming, and how many people that includes. You can add a meal preference, a phone number and questions of your own. If your wedding has several functions, per-event replies let guests give a number for each.",
        ],
      },
      {
        heading: "Replies are not headcount",
        body: [
          "Ten replies could mean ten people or forty. Always track the number attending, not the number of replies. In YoureIn the total attending is the sum of the people in every yes reply. See [wedding invitations with RSVP](/features/rsvp).",
        ],
      },
      {
        heading: "Why personal links make tracking easier",
        body: [
          "With one shared link, you depend on guests typing their name correctly, and you cannot tell who has not replied. With a [personal link per family](/features/personal-links), each reply is saved against the right family, and the guest list shows who is still missing ([guest tracking](/features/guest-tracking)).",
        ],
      },
      {
        heading: "Chasing replies politely",
        body: [
          "Set a reply-by date on the invitation. A week before it, look at the families who have not answered and send each of them a short message with their own link. Close RSVPs once the date has passed, so your numbers stop changing under you.",
        ],
      },
      {
        heading: "Privacy",
        body: ["Guests see only the invitation. Other guests' names, replies and totals are visible only to the host."],
      },
    ],
    faq: [
      { q: "Can a guest change their reply?", a: "Yes. A reply sent from a personal link updates that family's earlier reply." },
      { q: "Can I export the replies?", a: "Yes. You can download the replies from the host dashboard." },
    ],
    related: ["/features/rsvp", "/features/guest-tracking", "/features/personal-links"],
    updated: "2026-10-14",
  },
  {
    slug: "how-to-create-a-nikah-invitation-online",
    title: "How to Create a Nikah Invitation Online | YoureIn",
    h1: "How to Create a Nikah Invitation Online",
    description: "How to make a digital Nikah invitation: what to include, how to list the Nikah and the reception, and how to share it with family and guests.",
    intro: "A Nikah invitation tells guests where and when to gather, and often more than one function. Here is how to build one online and what to put on it.",
    primaryKeyword: "how to create a nikah invitation online",
    secondaryKeywords: ["nikah invitation wording", "make a digital nikah invitation"],
    sections: [
      {
        heading: "What to include",
        body: ["Families differ in how they word and arrange an invitation, so treat this as a checklist rather than a template."],
        bullets: [
          "The names of the bride and groom, and the families who are inviting",
          "An opening line or blessing, if your family would like one at the top (the editor has an optional welcome message at the very top, for a blessing, a verse or a greeting)",
          "The date and time of the Nikah, with the venue, address and a map link",
          "The reception, and any other gathering, as separate events",
          "A dress code, if you want to give one",
          "How to reply, and by when",
        ],
      },
      {
        heading: "List each function on its own",
        body: [
          "Rather than one long paragraph, add the Nikah and the reception as separate events, each with its own time and place. Guests can then reply for each ([wedding invitations with multiple events](/features/multiple-events)). A smaller gathering can be marked private so that only the families you choose will see it.",
        ],
      },
      {
        heading: "Choosing a design",
        body: [
          "The [Nikah invitation designs](/nikah-invitations) are built around moons, lanterns, palaces and night skies, with no figures. Preview them on your phone and choose the mood that suits the day.",
        ],
      },
      {
        heading: "Sharing with family",
        body: [
          "A single link works well in a family WhatsApp group. For a larger guest list, give each household a [personal link](/features/personal-links), so you know which families have replied. See [how to share wedding invitations on WhatsApp](/guides/how-to-share-wedding-invitations-on-whatsapp).",
        ],
      },
    ],
    related: ["/nikah-invitations", "/features/multiple-events", "/features/rsvp"],
    updated: "2026-10-14",
  },
  {
    slug: "how-to-share-wedding-invitations-on-whatsapp",
    title: "How to Share Wedding Invitations on WhatsApp | YoureIn",
    h1: "How to Share Wedding Invitations on WhatsApp",
    description: "How to send a digital wedding invitation on WhatsApp: one link or a personal link for each family, a ready-made message, and tips for large families and groups.",
    intro: "For most families WhatsApp is where the invitation will be opened. A few small choices make the difference between a link people open and one they scroll past.",
    primaryKeyword: "how to share wedding invitations on whatsapp",
    secondaryKeywords: ["send digital wedding invitation on whatsapp", "share wedding invitation link"],
    sections: [
      {
        heading: "One link or many",
        body: [
          "A single link is quickest, and works well in a family group. A [personal link for each family](/features/personal-links) takes a little longer, but it means each family's reply comes back under their own name, and you can see who has not replied.",
        ],
      },
      {
        heading: "Using the ready-made message",
        body: [
          "When you publish, YoureIn writes a short message with the names, the date and the link, and opens WhatsApp with it. For a personal link, the message can start with the family's name. Edit it before you send; a line in your own voice is better than a default.",
        ],
      },
      {
        heading: "Groups and individual chats",
        body: [
          "Send personal links in individual chats, not in a group, since everyone in a group would see everyone else's link. Use a group only for the general link.",
        ],
      },
      {
        heading: "Make sure it opens well",
        body: [
          "Open the link on your own phone first. Check the opening, the music (it plays only after a tap), the map link and the reply form. Then send it a few days before you start chasing replies.",
        ],
      },
      {
        heading: "Printed cards and posters",
        body: [
          "Add a [QR code](/features/qr-code) to a printed card or poster so relatives who prefer paper can still open the animated invitation.",
        ],
      },
    ],
    related: ["/features/personal-links", "/features/qr-code", "/guides/how-to-create-a-digital-wedding-invitation"],
    updated: "2026-10-14",
  },
];

export const getGuide = (slug: string) => GUIDES.find((g) => g.slug === slug);

export function guideToPage(g: Guide): SeoPage {
  return {
    id: `guide-${g.slug}`,
    type: "guide",
    path: `/guides/${g.slug}`,
    title: g.title,
    h1: g.h1,
    description: g.description,
    intro: g.intro,
    searchIntent: "Informational: " + g.primaryKeyword,
    primaryKeyword: g.primaryKeyword,
    secondaryKeywords: g.secondaryKeywords,
    templates: { by: "none" },
    minTemplates: 0,
    sections: g.sections,
    related: g.related,
    faq: g.faq,
    schemaType: "Article",
    crumbs: [
      { href: "/guides", label: "Guides" },
      { href: `/guides/${g.slug}`, label: g.h1 },
    ],
    updated: g.updated,
  };
}
