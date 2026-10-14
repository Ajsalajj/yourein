import type { StyleId } from "./types";

/**
 * What makes each design different, written once and used by the template page, the style collections
 * and the indexability rule. Facts here match the artwork and animation in src/invite/art/scenes/.
 */
export type TemplateProfile = {
  /** Used in the title and for the breadcrumb: the occasion this design is mostly chosen for. */
  occasion: "Wedding" | "Nikah" | "Engagement";
  styles: StyleId[];
  /** One paragraph, unique to this design. */
  summary: string;
  bestFor: string;
  /** Three or four things that set the design apart. */
  characteristics: string[];
  /** Alt text for the picture: what is in it, in plain words. */
  alt: string;
};

export const PROFILES: Record<string, TemplateProfile> = {
  "moonlit-mahal": {
    occasion: "Wedding",
    styles: ["royal"],
    summary:
      "Moonlit Mahal is a night-time palace invitation. A crescent rises over still water, the windows of the mahal light up one by one and the names arrive in gold lettering. Its arched sections run through the whole invitation, so the quiet, regal mood carries from the first tap to the RSVP.",
    bestFor: "Evening weddings and Nikah ceremonies that want a regal, moonlit mood.",
    characteristics: ["Midnight palette with warm gold lettering", "Arched sections and frames from top to bottom", "Palace windows that light up one after another"],
    alt: "Moonlit Mahal animated wedding invitation: a palace with lit windows beside still water under a crescent moon",
  },
  "velvet-opera": {
    occasion: "Wedding",
    styles: [],
    summary:
      "Velvet Opera treats the invitation like a night at the theatre. The house lights dim, a spotlight finds the stage and a velvet curtain parts on your names. The events are laid out as a programme in acts, and the RSVP is styled like a theatre ticket, which makes it the most theatrical design in the collection.",
    bestFor: "Receptions, cocktail evenings and couples who want something theatrical.",
    characteristics: ["Spotlight and velvet curtain opening", "Events shown as a programme in acts", "RSVP styled as a theatre ticket", "Serif display lettering instead of a script"],
    alt: "Velvet Opera animated invitation template: a red velvet curtain opening under a spotlight",
  },
  "ivory-wax-seal": {
    occasion: "Wedding",
    styles: ["minimal"],
    summary:
      "Ivory Wax Seal is the classic paper invitation, brought to life. An embossed ivory envelope is closed with a gold wax seal; the guest breaks it, the flap lifts and the card rises out. It is calm and uncluttered, and the invitation inside stays close to what a printed card would say.",
    bestFor: "Couples who want a timeless, classic stationery feel without much decoration.",
    characteristics: ["Embossed ivory envelope with a gold wax seal", "The card rises out of the envelope", "Restrained layout with plenty of white space"],
    alt: "Ivory Wax Seal animated wedding invitation: an ivory envelope closed with a gold wax seal",
  },
  "rose-garden": {
    occasion: "Wedding",
    styles: ["floral"],
    summary:
      "Rose Garden opens on blush garden roses that drift apart to show an arched walk, with your names beneath the arch. It is a soft, romantic design in pinks and creams, and it works as well for an engagement as for a wedding because the mood is gentle rather than formal.",
    bestFor: "Garden weddings, engagements and anyone who loves roses.",
    characteristics: ["Blush and cream palette", "Roses part from the centre to reveal the names", "Arched garden walk as the main scene"],
    alt: "Rose Garden animated wedding invitation: blush roses around an arched garden walk",
  },
  "jasmine-moon": {
    occasion: "Nikah",
    styles: [],
    summary:
      "Jasmine Moon begins in darkness. A crescent lights up over a midnight courtyard, lanterns glow one by one and white jasmine blooms around an arch. It is quiet and devotional in feeling, designed first for Nikah invitations, and it works well when the ceremony is in the evening.",
    bestFor: "Nikah invitations and evening ceremonies with a calm, reverent tone.",
    characteristics: ["Crescent moon over a midnight courtyard", "Glowing lanterns and blooming white jasmine", "Deep navy and gold palette"],
    alt: "Jasmine Moon animated Nikah invitation: a crescent moon over a courtyard with lanterns and white jasmine",
  },
  "royal-emerald": {
    occasion: "Wedding",
    styles: ["royal", "indian"],
    summary:
      "Royal Emerald opens with tall emerald doors that swing apart on a palace lit in antique gold, arch after arch. The deep green and gold give it a grand, ceremonial feel, which is why it is one of the most chosen designs for large family weddings and for Nikah receptions alike.",
    bestFor: "Large family weddings, Nikah receptions and celebrations that want a grand, palace feel.",
    characteristics: ["Emerald and antique gold palette", "Great doors opening onto a palace of arches", "Dark, rich background with warm light"],
    alt: "Royal Emerald animated wedding invitation: emerald doors opening onto a palace lit in antique gold",
  },
  "silk-ribbon": {
    occasion: "Engagement",
    styles: ["minimal"],
    summary:
      "Silk Ribbon is a blush satin bow tied across the card. The guest pulls it loose, the ribbon slides away to both sides and the invitation is revealed. It is light and gift-like, which suits an engagement or a small, intimate wedding.",
    bestFor: "Engagements, small weddings and gift-like, intimate celebrations.",
    characteristics: ["Blush satin bow that loosens as you open", "Soft, paper-based layout", "Gentle pink and ivory palette"],
    alt: "Silk Ribbon animated engagement invitation: a blush satin bow tied across an ivory card",
  },
  "pearl-vellum": {
    occasion: "Wedding",
    styles: ["minimal", "floral"],
    summary:
      "Pearl Vellum shows white orchids behind a sheet of translucent vellum that lifts away as the invitation opens. It is pale, airy and modern, and because the mood is elegant rather than tied to one wedding tradition it also suits an anniversary celebration.",
    bestFor: "Modern weddings and anniversary celebrations that want an airy, elegant look.",
    characteristics: ["White orchids seen through translucent vellum", "Vellum sheet glides upward to open", "Pale pearl and white palette"],
    alt: "Pearl Vellum animated wedding invitation: white orchids behind a sheet of translucent vellum",
  },
  "golden-palace": {
    occasion: "Wedding",
    styles: ["royal", "indian"],
    summary:
      "Golden Palace opens gilded gates onto a sunlit palace courtyard in warm ivory and gold. Unlike the darker palace designs it is bright and daylit, so it feels celebratory rather than hushed, and it suits daytime ceremonies and Indian weddings with a regal tone.",
    bestFor: "Daytime weddings and Indian celebrations that want a bright, regal look.",
    characteristics: ["Gilded gates swinging open", "Sunlit courtyard in ivory and gold", "Bright palette, unlike the night-time palace designs"],
    alt: "Golden Palace animated wedding invitation: gilded gates opening onto a sunlit palace courtyard",
  },
  "garden-swing": {
    occasion: "Wedding",
    styles: ["floral"],
    summary:
      "Garden Swing places a flower-wrapped swing under a canopy of blooms, with soft hills behind it in afternoon light. As the invitation opens the canopy lifts and the garden spreads out around the swing. It is relaxed and outdoorsy, and well suited to engagements and garden weddings.",
    bestFor: "Garden and outdoor weddings, engagements and relaxed daytime celebrations.",
    characteristics: ["Flower-wrapped swing as the centrepiece", "Canopy of blooms that lifts away", "Soft hills and warm afternoon light"],
    alt: "Garden Swing animated wedding invitation: a swing wrapped in flowers under a canopy of blooms",
  },
  "cherry-blossom": {
    occasion: "Wedding",
    styles: ["floral"],
    summary:
      "Cherry Blossom is light and spare: a blossom branch reaches across cream paper while a few pink petals drift down. There is less scenery than in the garden designs, so the names and the details stay in front, which makes it a good choice for a modern wedding or engagement.",
    bestFor: "Modern weddings and engagements that want delicate florals without heavy scenery.",
    characteristics: ["Blossom branch across cream paper", "A few drifting pink petals", "Clean layout that keeps the details in front"],
    alt: "Cherry Blossom animated wedding invitation: a blossom branch across cream paper with falling pink petals",
  },
  "marigold-celebration": {
    occasion: "Wedding",
    styles: ["floral", "indian"],
    summary:
      "Marigold Celebration opens curtains of marigold garlands on a mandap dressed with lamps, flower strings and gold. It is bright and festive, drawn for Indian weddings with several functions, and it is the design to choose when the colour and energy of the celebration matter most.",
    bestFor: "Indian weddings with several functions, especially mehendi, haldi and sangeet.",
    characteristics: ["Curtains of marigold garlands that draw apart", "Mandap with lamps and flower strings", "Warm orange and gold palette"],
    alt: "Marigold Celebration animated Indian wedding invitation: marigold garlands parting on a mandap with lamps",
  },
  "celestial-veil": {
    occasion: "Wedding",
    styles: [],
    summary:
      "Celestial Veil is a night sky invitation. A sheer veil drifts across the stars, floats aside, and moonlight falls across the names. It is dreamy and romantic, with no tie to a particular tradition, which is why it works for both weddings and Nikah ceremonies in the evening.",
    bestFor: "Evening weddings and Nikah ceremonies that want a dreamy, starlit mood.",
    characteristics: ["Sheer veil drifting across a starlit sky", "Moonlight that falls across the names", "Deep night palette with soft highlights"],
    alt: "Celestial Veil animated wedding invitation: a sheer veil across a starlit night sky and moon",
  },
  "botanical-vow": {
    occasion: "Wedding",
    styles: ["minimal", "floral"],
    summary:
      "Botanical Vow draws watercolour greenery around a clean ivory card, branch by branch and leaf by leaf. It has no flowers to speak of, only leaves, so it is quiet, modern and very green, and it fits couples who want something fresh and understated.",
    bestFor: "Modern, understated weddings and outdoor or eco-minded celebrations.",
    characteristics: ["Watercolour greenery drawn around the card", "Branches that draw themselves leaf by leaf", "Clean ivory card with a green palette"],
    alt: "Botanical Vow animated wedding invitation: watercolour greenery drawn around a clean ivory card",
  },
  "temple-heritage": {
    occasion: "Wedding",
    styles: ["indian"],
    summary:
      "Temple Heritage is drawn for South Indian weddings: carved temple gates part to reveal a gopuram, with brass lamps and banana leaves in cream and gold. It carries the look of a temple wedding, with its traditional colours and ornament, without needing any explanation.",
    bestFor: "South Indian and Kerala weddings, including temple ceremonies.",
    characteristics: ["Carved temple gates opening on a gopuram", "Brass lamps and banana leaves", "Cream and gold palette"],
    alt: "Temple Heritage animated South Indian wedding invitation: carved temple gates opening on a gopuram with brass lamps",
  },
  "kerala-ivory": {
    occasion: "Wedding",
    styles: ["indian"],
    summary:
      "Kerala Ivory takes its colours from kasavu, the gold-bordered ivory cloth of Kerala. A carved wooden doorway swings open on a tharavadu courtyard under coconut palms, with lamps lit and jasmine strung overhead. It is gentle and rooted in a place, which makes it the first choice for a Kerala wedding.",
    bestFor: "Kerala weddings, from the engagement to the wedding day.",
    characteristics: ["Ivory and kasavu-gold palette", "Carved wooden door opening on a tharavadu courtyard", "Coconut palms, lit lamps and strung jasmine"],
    alt: "Kerala Ivory animated wedding invitation: a carved wooden doorway opening on a courtyard under coconut palms",
  },
  "scenic-romance": {
    occasion: "Wedding",
    styles: [],
    summary:
      "Scenic Romance puts a couple at the edge of a lake at sunset, with mountains that move as the guest scrolls. Evening mist clears to bring the lake, the mountains and the two of you into focus. It is the most cinematic of the designs and works well for destination weddings.",
    bestFor: "Destination weddings and couples who want a cinematic, scenic invitation.",
    characteristics: ["Lake and mountains at sunset", "Mountains that move as you scroll", "Evening mist that clears to bring the couple into focus"],
    alt: "Scenic Romance animated wedding invitation: a couple beside a lake at sunset with mountains behind",
  },
};
