export const CATEGORIES = [
  "Wedding",
  "Nikah",
  "Engagement",
  "Birthday",
  "Baby Shower",
  "Housewarming",
  "Anniversary",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type InviteEvent = {
  title: string;
  day: string;
  time: string;
  place: string;
  note?: string;
  /** Present on a customer's own events: used for replies to each function. */
  id?: string;
  dressCode?: string;
};

export type Theme = {
  /** Page colours inside the invitation. */
  bg: string;
  bgAlt: string;
  ink: string;
  soft: string;
  accent: string;
  /** Second colour used for florals, washes and frames. */
  tint: string;
  dark?: boolean;
  script: "pinyon" | "allura";
  caps: "cinzel" | "cormorant";
  /** Small ornament drawn between sections. */
  motif: "sprig" | "rose" | "jasmine" | "star" | "lotus" | "marigold" | "orchid" | "blossom" | "leaf" | "lamp" | "palm";
  /** Shape of the picture frames. */
  frame: "arch" | "ogee" | "oval" | "rect";
  /** Which cinematic mid-section the invitation uses. */
  family: "paper" | "arch" | "scenic";
  /** Hero lettering: vertical position (% of screen) and colour. */
  heroTop: number;
  heroInk: string;
  /** Backdrop colour behind the phone in the catalog. */
  plinth: string;
};

export type RsvpSettings = {
  enabled: boolean;
  /** Last day to reply, 'YYYY-MM-DD', or '' for no deadline. */
  deadline: string;
  allowMaybe: boolean;
  askPhone: boolean;
  askMeal: boolean;
  mealOptions: string[];
  askMessage: boolean;
  /** Most people one reply can bring. */
  maxPerInvite: number;
  /** Optional total capacity of the event. */
  capacity: number | null;
  /** Stop accepting "yes" replies once capacity is reached. */
  hardCapacity: boolean;
  /** Guests reply to each function separately (when there is more than one). */
  perEvent: boolean;
  /** The host's own questions, asked on every reply. */
  questions: RsvpQuestion[];
};

export type RsvpQuestion = { id: string; label: string; kind: "text" | "yesno" | "choice"; options: string[] };

/** A guest's message on the invitation's guestbook, as guests see it. */
export type Wish = { id: string; name: string; message: string; createdAt: string; photo?: string };

/** Everything a customer's own invitation adds on top of a design. */
export type Live = {
  /** "preview": the host is looking at it. "public": a guest has opened the link. */
  mode: "preview" | "public";
  eventTitle: string;
  portrait?: string;
  gallery: string[];
  music?: string;
  mapsUrl?: string;
  countdown: boolean;
  contacts: { name: string; phone: string }[];
  allowShare: boolean;
  rsvp: (RsvpSettings & { closed: boolean; full: boolean }) | null;
  /** Present when the host has the guestbook switched on. */
  guestbook: { wishes: Wish[]; photos: boolean } | null;
  /** Thank-you mode: shown at the top once the event is over. */
  thanks?: string;
  /** An update from the hosts, shown at the top. */
  notice?: string;
  /** Places to stay the hosts suggest. */
  stays: { name: string; note: string; url: string; phone: string }[];
  /** Public address of this invitation, once published. */
  invitation?: string;
  shareUrl?: string;
  /** Set when the link is personalised for one guest or family. */
  guest?: { slug: string; name: string; max: number | null; note: string; replied?: { status: "yes" | "maybe" | "no"; count: number; events?: Record<string, number>; answers?: Record<string, string>; meal?: string } };
};

export type Template = {
  no: string;
  slug: string;
  name: string;
  /** Label shown on the card. */
  category: string;
  /** Catalog filters this design appears under. */
  filters: Category[];
  blurb: string;
  opening: string;
  /** What the first tap says. */
  openLabel: string;
  featured?: boolean;
  /** Thumbnail shows the sealed cover (true) or the opened first screen. */
  thumbCover?: boolean;
  couple: [string, string];
  /** ISO date-time of the main ceremony, used by the countdown. */
  date: string;
  dateLabel: string;
  invocation?: string;
  hosts: string;
  request: string;
  story: string;
  events: InviteEvent[];
  venue: { name: string; address: string; city: string };
  closing: string;
  theme: Theme;
  /** IANA time zone the date is in. Sample designs use India time. */
  tz?: string;
  /** Present only when rendering a customer's invitation. */
  live?: Live;
};

export const TEMPLATES: Template[] = [
  {
    no: "01",
    slug: "ivory-wax-seal",
    name: "Ivory Wax Seal",
    category: "Wedding",
    filters: ["Wedding"],
    blurb: "An embossed ivory envelope sealed in gold wax. Break the seal and the card rises out.",
    opening: "The wax seal breaks, the flap lifts and the invitation card rises from the envelope.",
    openLabel: "Tap to open",
    featured: true,
    thumbCover: true,
    couple: ["Aarav", "Meera"],
    date: "2026-11-21T18:30:00+05:30",
    dateLabel: "21 November 2026",
    hosts: "Together with their families, Mr. & Mrs. Rajiv Malhotra and Mr. & Mrs. Sunil Kapoor",
    request: "request the pleasure of your company at the wedding of",
    story: "Seven years, two cities and one very long train ride later, we are finally doing this. Come and celebrate with us.",
    events: [
      { title: "Mehendi", day: "Thursday, 19 November", time: "4:00 pm", place: "The Courtyard, Amber Niwas", note: "Dress in shades of green and yellow" },
      { title: "Sangeet", day: "Friday, 20 November", time: "7:30 pm", place: "The Durbar Hall, Amber Niwas", note: "Cocktails and dancing" },
      { title: "Wedding", day: "Saturday, 21 November", time: "6:30 pm", place: "The Lake Lawn, Amber Niwas", note: "Pheras at sunset, dinner to follow" },
    ],
    venue: { name: "Amber Niwas", address: "Lake Road, Sajjangarh", city: "Udaipur, Rajasthan" },
    closing: "Your presence is the only gift we ask for.",
    theme: {
      bg: "#FAF5EA", bgAlt: "#F3EBDB", ink: "#4E402B", soft: "#8A7758", accent: "#A98443", tint: "#DCCBA6",
      script: "pinyon", caps: "cormorant", motif: "sprig", frame: "arch", family: "paper",
      heroTop: 40, heroInk: "#5A4826", plinth: "#EFE6D3",
    },
  },
  {
    no: "02",
    slug: "rose-garden",
    name: "Rose Garden",
    category: "Wedding / Engagement",
    filters: ["Wedding", "Engagement"],
    blurb: "Blush garden roses part to reveal an arched walk and your names beneath it.",
    opening: "Roses drift apart from the centre and the names appear in the clearing.",
    openLabel: "Tap to open",
    couple: ["Siddharth", "Tara"],
    date: "2026-12-06T17:00:00+05:30",
    dateLabel: "6 December 2026",
    hosts: "With the blessings of their parents, Dr. & Mrs. Anil Bhatia and Mr. & Mrs. Vikram Sethi",
    request: "invite you to celebrate the wedding of",
    story: "He brought her roses on the first date. She told him she preferred peonies. He has been getting it right ever since.",
    events: [
      { title: "Haldi", day: "Saturday, 5 December", time: "10:00 am", place: "The Orchard, Rosemere Estate", note: "Wear yellow, expect to get messy" },
      { title: "Wedding", day: "Sunday, 6 December", time: "5:00 pm", place: "The Rose Walk, Rosemere Estate" },
      { title: "Reception", day: "Sunday, 6 December", time: "8:00 pm", place: "The Glasshouse, Rosemere Estate" },
    ],
    venue: { name: "Rosemere Estate", address: "Old Mussoorie Road", city: "Dehradun, Uttarakhand" },
    closing: "Come for the vows, stay for the dancing.",
    theme: {
      bg: "#FCF4EF", bgAlt: "#F7E7E1", ink: "#6A3B38", soft: "#9A716A", accent: "#B4835A", tint: "#E9B5B3",
      script: "allura", caps: "cormorant", motif: "rose", frame: "arch", family: "scenic",
      heroTop: 31, heroInk: "#7A3F3C", plinth: "#F4DEDA",
    },
  },
  {
    no: "03",
    slug: "jasmine-moon",
    name: "Jasmine Moon",
    category: "Nikah",
    filters: ["Nikah"],
    blurb: "A crescent over a midnight courtyard, lanterns glowing and white jasmine in bloom.",
    opening: "The screen is dark. The crescent lights, the lanterns glow and jasmine blooms around the arch.",
    openLabel: "Open invitation",
    couple: ["Zayan", "Aaliyah"],
    date: "2026-12-14T19:00:00+05:30",
    dateLabel: "14 December 2026",
    invocation: "In the name of Allah, the Most Gracious, the Most Merciful",
    hosts: "Mr. & Mrs. Imran Qureshi and Mr. & Mrs. Faisal Siddiqui",
    request: "request the honour of your presence at the Nikah of their children",
    story: "Two families, one prayer answered. We ask you to join us with your duas as we begin our life together.",
    events: [
      { title: "Mehndi", day: "Saturday, 12 December", time: "7:00 pm", place: "Noor Mahal Courtyard" },
      { title: "Nikah", day: "Monday, 14 December", time: "7:00 pm", place: "The Marble Hall, Noor Mahal", note: "After Maghrib prayers" },
      { title: "Walima", day: "Tuesday, 15 December", time: "8:00 pm", place: "The Garden Pavilion, Noor Mahal" },
    ],
    venue: { name: "Noor Mahal", address: "Banjara Hills, Road No. 12", city: "Hyderabad, Telangana" },
    closing: "Kindly remember us in your prayers.",
    theme: {
      bg: "#0E1632", bgAlt: "#131E42", ink: "#F3EAD3", soft: "#B9B3C6", accent: "#D8B36A", tint: "#27376B",
      dark: true, script: "allura", caps: "cinzel", motif: "jasmine", frame: "ogee", family: "arch",
      heroTop: 34, heroInk: "#F6ECD2", plinth: "#1A2447",
    },
  },
  {
    no: "04",
    slug: "royal-emerald",
    name: "Royal Emerald",
    category: "Wedding / Nikah",
    filters: ["Wedding", "Nikah"],
    blurb: "Tall emerald doors open on a palace lit in antique gold, arch after arch.",
    opening: "The great doors swing open and warm palace light spills across the screen.",
    openLabel: "Enter invitation",
    featured: true,
    couple: ["Hamza", "Sara"],
    date: "2026-11-21T19:30:00+05:30",
    dateLabel: "21 November 2026",
    hosts: "Mr. & Mrs. Tariq Ansari and Mr. & Mrs. Salman Mirza",
    request: "request the honour of your presence at the wedding of",
    story: "They met across a crowded dinner table and argued about biryani for an hour. The argument is still going.",
    events: [
      { title: "Mehndi", day: "Thursday, 19 November", time: "6:00 pm", place: "Zenana Courtyard, Qila Mubarak" },
      { title: "Nikah", day: "Saturday, 21 November", time: "7:30 pm", place: "Diwan-e-Khas, Qila Mubarak" },
      { title: "Walima", day: "Sunday, 22 November", time: "8:00 pm", place: "The Emerald Lawn, Qila Mubarak", note: "Dinner under the stars" },
    ],
    venue: { name: "Qila Mubarak", address: "Hazratganj, Palace Road", city: "Lucknow, Uttar Pradesh" },
    closing: "We would be honoured to have you with us.",
    theme: {
      bg: "#0B2A22", bgAlt: "#0F362C", ink: "#F2E7C9", soft: "#B8C2AE", accent: "#CFA658", tint: "#1B5744",
      dark: true, script: "pinyon", caps: "cinzel", motif: "star", frame: "ogee", family: "arch",
      heroTop: 31, heroInk: "#F4E6BF", plinth: "#123B30",
    },
  },
  {
    no: "05",
    slug: "silk-ribbon",
    name: "Silk Ribbon",
    category: "Engagement / Wedding",
    filters: ["Engagement", "Wedding"],
    blurb: "A blush satin bow tied across the card. Pull it loose and the invitation is yours.",
    opening: "The satin bow loosens, the ribbon slides away to both sides and the card is revealed.",
    openLabel: "Tap to open",
    thumbCover: true,
    couple: ["Rohan", "Isha"],
    date: "2027-01-18T18:00:00+05:30",
    dateLabel: "18 January 2027",
    hosts: "Mr. & Mrs. Deepak Arora and Mr. & Mrs. Sanjay Khanna",
    request: "joyfully invite you to the engagement of",
    story: "She said yes on a rooftop in Bandra, halfway through dessert. Now come and help us make it official.",
    events: [
      { title: "Ring ceremony", day: "Monday, 18 January", time: "6:00 pm", place: "The Atrium, Marine House" },
      { title: "Dinner", day: "Monday, 18 January", time: "8:00 pm", place: "The Terrace, Marine House", note: "Sea-facing, bring a shawl" },
    ],
    venue: { name: "Marine House", address: "Worli Sea Face", city: "Mumbai, Maharashtra" },
    closing: "We cannot wait to raise a glass with you.",
    theme: {
      bg: "#FCF2EE", bgAlt: "#F7E4DE", ink: "#73443F", soft: "#A27A72", accent: "#BE9267", tint: "#EDBDB6",
      script: "pinyon", caps: "cormorant", motif: "blossom", frame: "rect", family: "paper",
      heroTop: 30, heroInk: "#7C4640", plinth: "#F6DDD6",
    },
  },
  {
    no: "06",
    slug: "pearl-vellum",
    name: "Pearl Vellum",
    category: "Wedding / Anniversary",
    filters: ["Wedding", "Anniversary"],
    blurb: "White orchids behind a sheet of translucent vellum that lifts away as you open it.",
    opening: "The vellum sheet glides upward and the invitation appears beneath it.",
    openLabel: "Tap to open",
    couple: ["Arjun", "Kavya"],
    date: "2027-02-13T11:00:00+05:30",
    dateLabel: "13 February 2027",
    hosts: "Mr. & Mrs. Mohan Reddy and Mr. & Mrs. Prakash Iyer",
    request: "request the pleasure of your company at the wedding of",
    story: "Lab partners first, then flatmates, then the only two people who laugh at each other's jokes.",
    events: [
      { title: "Wedding", day: "Saturday, 13 February", time: "11:00 am", place: "The Orchid Room, Pearl Court" },
      { title: "Lunch", day: "Saturday, 13 February", time: "1:00 pm", place: "The Conservatory, Pearl Court" },
      { title: "Reception", day: "Saturday, 13 February", time: "7:30 pm", place: "The Ballroom, Pearl Court" },
    ],
    venue: { name: "Pearl Court", address: "Lavelle Road", city: "Bengaluru, Karnataka" },
    closing: "With love and gratitude, we look forward to seeing you.",
    theme: {
      bg: "#FAF8F3", bgAlt: "#F1EEE5", ink: "#5E5038", soft: "#928670", accent: "#B79A63", tint: "#E3DCCB",
      script: "allura", caps: "cormorant", motif: "orchid", frame: "oval", family: "paper",
      heroTop: 35, heroInk: "#6A583A", plinth: "#EDE8DC",
    },
  },
  {
    no: "07",
    slug: "golden-palace",
    name: "Golden Palace",
    category: "Wedding",
    filters: ["Wedding"],
    blurb: "Gilded gates swing wide on a sunlit palace courtyard in warm ivory and gold.",
    opening: "The palace gates open and warm sunlight pours in across the courtyard.",
    openLabel: "Enter invitation",
    couple: ["Vihaan", "Anaya"],
    date: "2026-11-21T17:30:00+05:30",
    dateLabel: "21 November 2026",
    hosts: "Maharaj Kumar Devendra Singh Rathore & family and Thakur Ranvijay Singh Shekhawat & family",
    request: "request your gracious presence at the wedding of",
    story: "A wedding the way our grandparents would have done it: three days, one palace and everyone we love.",
    events: [
      { title: "Mehendi", day: "Thursday, 19 November", time: "3:00 pm", place: "Zenana Bagh, Suraj Mahal" },
      { title: "Sangeet", day: "Friday, 20 November", time: "7:00 pm", place: "Sheesh Mahal, Suraj Mahal" },
      { title: "Baraat & Pheras", day: "Saturday, 21 November", time: "5:30 pm", place: "The Grand Courtyard, Suraj Mahal" },
      { title: "Reception", day: "Sunday, 22 November", time: "8:00 pm", place: "Durbar Lawn, Suraj Mahal" },
    ],
    venue: { name: "Suraj Mahal", address: "Fort Road, Old City", city: "Jodhpur, Rajasthan" },
    closing: "Padharo mhare des. We await you with open hearts.",
    theme: {
      bg: "#FCF3E1", bgAlt: "#F6E7C8", ink: "#65421A", soft: "#96774A", accent: "#B5852E", tint: "#E9C987",
      script: "allura", caps: "cinzel", motif: "lotus", frame: "ogee", family: "arch",
      heroTop: 31, heroInk: "#7A4B14", plinth: "#F3E1BC",
    },
  },
  {
    no: "08",
    slug: "garden-swing",
    name: "Garden Swing",
    category: "Wedding / Engagement",
    filters: ["Wedding", "Engagement"],
    blurb: "A flower-wrapped swing under a canopy of blooms, with soft hills in the afternoon light.",
    opening: "The flower canopy lifts and the garden opens out behind the swing.",
    openLabel: "Tap to open",
    couple: ["Kabir", "Aditi"],
    date: "2026-12-17T16:30:00+05:30",
    dateLabel: "17 December 2026",
    hosts: "Mr. & Mrs. Ashok Mehra and Mr. & Mrs. Naveen Joshi",
    request: "invite you to an afternoon in the garden for the wedding of",
    story: "He proposed on her grandmother's garden swing. It seemed only right to get married beside one.",
    events: [
      { title: "Garden brunch", day: "Wednesday, 16 December", time: "11:00 am", place: "The Lawn, Meadowlark Farm" },
      { title: "Wedding", day: "Thursday, 17 December", time: "4:30 pm", place: "The Swing Garden, Meadowlark Farm" },
      { title: "Supper", day: "Thursday, 17 December", time: "7:30 pm", place: "The Long Table, Meadowlark Farm" },
    ],
    venue: { name: "Meadowlark Farm", address: "Sohna Road", city: "Gurugram, Haryana" },
    closing: "Bring comfortable shoes. The lawn is long and the evening is longer.",
    theme: {
      bg: "#F8F6EA", bgAlt: "#EEEEDC", ink: "#55432C", soft: "#857A5E", accent: "#B0864A", tint: "#C7D2A6",
      script: "allura", caps: "cormorant", motif: "leaf", frame: "arch", family: "scenic",
      heroTop: 27, heroInk: "#6B4A2A", plinth: "#E5E8CF",
    },
  },
  {
    no: "09",
    slug: "cherry-blossom",
    name: "Cherry Blossom",
    category: "Wedding / Engagement",
    filters: ["Wedding", "Engagement"],
    blurb: "A blossom branch reaches across cream paper while a few pink petals drift down.",
    opening: "A blossom branch sweeps in from the corner and a handful of petals drift across.",
    openLabel: "Tap to open",
    couple: ["Karan", "Nisha"],
    date: "2027-03-19T17:00:00+05:30",
    dateLabel: "19 March 2027",
    hosts: "Mr. & Mrs. Harish Oberoi and Mr. & Mrs. Rakesh Verma",
    request: "invite you to celebrate the wedding of",
    story: "We picked March so the trees would be in bloom. Shillong agreed to cooperate.",
    events: [
      { title: "Welcome tea", day: "Thursday, 18 March", time: "4:00 pm", place: "The Verandah, Pinewood House" },
      { title: "Wedding", day: "Friday, 19 March", time: "5:00 pm", place: "The Blossom Grove, Pinewood House" },
      { title: "Dinner", day: "Friday, 19 March", time: "7:30 pm", place: "The Hall, Pinewood House" },
    ],
    venue: { name: "Pinewood House", address: "Upper Lachumiere", city: "Shillong, Meghalaya" },
    closing: "Spring is short. Come and spend a little of it with us.",
    theme: {
      bg: "#FDF4F2", bgAlt: "#F9E5E6", ink: "#6C3041", soft: "#9E6F79", accent: "#BF8576", tint: "#F3BCC9",
      script: "allura", caps: "cormorant", motif: "blossom", frame: "oval", family: "scenic",
      heroTop: 30, heroInk: "#7B2F40", plinth: "#F7DADF",
    },
  },
  {
    no: "10",
    slug: "marigold-celebration",
    name: "Marigold Celebration",
    category: "Indian Wedding",
    filters: ["Wedding"],
    blurb: "Curtains of marigold part on a mandap dressed in lamps, flower strings and gold.",
    opening: "The marigold garlands draw apart and the mandap comes into view.",
    openLabel: "Tap to open",
    couple: ["Aditya", "Priya"],
    date: "2026-11-23T10:30:00+05:30",
    dateLabel: "23 November 2026",
    invocation: "Shree Ganeshaya Namah",
    hosts: "Smt. & Shri Ramesh Agarwal and Smt. & Shri Mahesh Gupta",
    request: "seek your blessings at the shubh vivah of",
    story: "Two families, four days, more marigolds than anyone has counted. Please come hungry.",
    events: [
      { title: "Haldi", day: "Saturday, 21 November", time: "9:00 am", place: "Aangan, Kesar Haveli" },
      { title: "Sangeet", day: "Sunday, 22 November", time: "7:00 pm", place: "Rang Mahal, Kesar Haveli" },
      { title: "Shubh Vivah", day: "Monday, 23 November", time: "10:30 am", place: "The Mandap, Kesar Haveli", note: "Muhurat at 11:12 am" },
      { title: "Reception", day: "Monday, 23 November", time: "8:00 pm", place: "Bagh, Kesar Haveli" },
    ],
    venue: { name: "Kesar Haveli", address: "Civil Lines", city: "Jaipur, Rajasthan" },
    closing: "Aapki upasthiti hi hamara saubhagya hai.",
    theme: {
      bg: "#FFF6E3", bgAlt: "#FBEAC6", ink: "#6A2D0F", soft: "#9A6A3C", accent: "#D4870F", tint: "#F6B33A",
      script: "allura", caps: "cormorant", motif: "marigold", frame: "arch", family: "arch",
      heroTop: 30, heroInk: "#7A2E0C", plinth: "#F8E1AE",
    },
  },
  {
    no: "11",
    slug: "celestial-veil",
    name: "Celestial Veil",
    category: "Wedding / Nikah",
    filters: ["Wedding", "Nikah"],
    blurb: "A sheer veil drifts across a starlit sky and the moon lights your names.",
    opening: "The veil floats aside and moonlight falls across the invitation.",
    openLabel: "Open invitation",
    couple: ["Rehan", "Sana"],
    date: "2027-01-12T19:30:00+05:30",
    dateLabel: "12 January 2027",
    invocation: "In the name of Allah, the Most Gracious, the Most Merciful",
    hosts: "Mr. & Mrs. Arif Khan and Mr. & Mrs. Javed Hashmi",
    request: "request the honour of your presence at the Nikah of their children",
    story: "Written in the stars, they say. We like to think we helped a little.",
    events: [
      { title: "Mehndi", day: "Sunday, 10 January", time: "7:00 pm", place: "The Rooftop, Mahtab Bagh Palace" },
      { title: "Nikah", day: "Tuesday, 12 January", time: "7:30 pm", place: "The Moon Court, Mahtab Bagh Palace" },
      { title: "Walima", day: "Wednesday, 13 January", time: "8:00 pm", place: "The Star Lawn, Mahtab Bagh Palace" },
    ],
    venue: { name: "Mahtab Bagh Palace", address: "Shamla Hills", city: "Bhopal, Madhya Pradesh" },
    closing: "Keep us in your duas, tonight and always.",
    theme: {
      bg: "#0C1434", bgAlt: "#121C46", ink: "#F2ECDC", soft: "#B4B5CF", accent: "#D7BB7B", tint: "#2A3A78",
      dark: true, script: "allura", caps: "cinzel", motif: "star", frame: "oval", family: "scenic",
      heroTop: 43, heroInk: "#F7F0DE", plinth: "#182250",
    },
  },
  {
    no: "12",
    slug: "botanical-vow",
    name: "Botanical Vow",
    category: "Wedding",
    filters: ["Wedding"],
    blurb: "Watercolour greenery grows around a clean ivory card. Quiet, modern and very green.",
    opening: "Branches draw themselves around the card, leaf by leaf.",
    openLabel: "Tap to open",
    couple: ["Dev", "Ananya"],
    date: "2027-02-20T16:00:00+05:30",
    dateLabel: "20 February 2027",
    hosts: "Together with their parents, Mr. & Mrs. Kiran Shah and Mr. & Mrs. Nitin Desai",
    request: "invite you to witness their vows",
    story: "No fuss, no fireworks. Just the two of us, the people we love and a great deal of greenery.",
    events: [
      { title: "Vows", day: "Saturday, 20 February", time: "4:00 pm", place: "The Greenhouse, Fernhill" },
      { title: "Garden party", day: "Saturday, 20 February", time: "5:30 pm", place: "The Lower Lawn, Fernhill" },
    ],
    venue: { name: "Fernhill", address: "Koregaon Park, Lane 7", city: "Pune, Maharashtra" },
    closing: "Come as you are. Leave a little happier.",
    theme: {
      bg: "#FAF8F1", bgAlt: "#EFF0E4", ink: "#434F3A", soft: "#7C866F", accent: "#A38F57", tint: "#B9C6A6",
      script: "allura", caps: "cormorant", motif: "leaf", frame: "arch", family: "paper",
      heroTop: 35, heroInk: "#4C5A3F", plinth: "#E3E7D4",
    },
  },
  {
    no: "13",
    slug: "temple-heritage",
    name: "Temple Heritage",
    category: "Indian Wedding",
    filters: ["Wedding"],
    blurb: "A South Indian temple tower, brass lamps and banana leaves in cream and gold.",
    opening: "Carved temple gates part and the gopuram rises beyond them.",
    openLabel: "Enter invitation",
    couple: ["Aravind", "Lakshmi"],
    date: "2026-11-28T07:30:00+05:30",
    dateLabel: "28 November 2026",
    invocation: "Sri Rama Jayam",
    hosts: "Smt. & Sri. K. Venkataraman and Smt. & Sri. S. Narayanan",
    request: "solicit your gracious presence with family at the marriage of",
    story: "A muhurtham at dawn, filter coffee after, and a banana-leaf lunch nobody will forget.",
    events: [
      { title: "Nichayathartham", day: "Friday, 27 November", time: "6:00 pm", place: "Sri Meenakshi Kalyana Mandapam" },
      { title: "Muhurtham", day: "Saturday, 28 November", time: "7:30 am", place: "Sri Meenakshi Kalyana Mandapam", note: "Between 7:30 and 9:00 am" },
      { title: "Reception", day: "Saturday, 28 November", time: "6:30 pm", place: "Sri Meenakshi Kalyana Mandapam" },
    ],
    venue: { name: "Sri Meenakshi Kalyana Mandapam", address: "West Masi Street", city: "Madurai, Tamil Nadu" },
    closing: "With the blessings of our elders, we await your presence.",
    theme: {
      bg: "#FCF4E2", bgAlt: "#F6E8C9", ink: "#5B2C12", soft: "#8F6842", accent: "#B4832A", tint: "#E3C078",
      script: "allura", caps: "cormorant", motif: "lamp", frame: "arch", family: "arch",
      heroTop: 68, heroInk: "#6A3110", plinth: "#F1DFB6",
    },
  },
  {
    no: "14",
    slug: "kerala-ivory",
    name: "Kerala Ivory",
    category: "Wedding",
    filters: ["Wedding"],
    blurb: "Kasavu gold on ivory, a tharavadu under coconut palms, lamps lit and jasmine strung.",
    opening: "A carved wooden doorway swings open on the courtyard beyond.",
    openLabel: "Enter invitation",
    couple: ["Nikhil", "Sneha"],
    date: "2027-01-16T10:15:00+05:30",
    dateLabel: "16 January 2027",
    hosts: "Smt. & Sri. P. Madhavan Nair and Smt. & Sri. K. Gopalakrishna Menon",
    request: "request your presence and blessings at the wedding of",
    story: "A morning thalikettu, a sadya served on banana leaf and an afternoon on the backwaters.",
    events: [
      { title: "Thalikettu", day: "Saturday, 16 January", time: "10:15 am", place: "Thekkumkoor Tharavadu", note: "Muhurtham between 10:15 and 10:45 am" },
      { title: "Sadya", day: "Saturday, 16 January", time: "12:00 pm", place: "The Oottupura, Thekkumkoor Tharavadu" },
      { title: "Reception", day: "Saturday, 16 January", time: "6:00 pm", place: "The Lakeside Lawn" },
    ],
    venue: { name: "Thekkumkoor Tharavadu", address: "Kumarakom Road", city: "Kottayam, Kerala" },
    closing: "Ellavarkkum swagatham. Everyone is welcome.",
    theme: {
      bg: "#FCF7EA", bgAlt: "#F4EBD2", ink: "#4D3A1C", soft: "#84724C", accent: "#BF9C3E", tint: "#D9C48A",
      script: "allura", caps: "cormorant", motif: "palm", frame: "arch", family: "arch",
      heroTop: 66, heroInk: "#5A4118", plinth: "#ECE2C4",
    },
  },
  {
    no: "15",
    slug: "scenic-romance",
    name: "Scenic Romance",
    category: "Wedding",
    filters: ["Wedding"],
    blurb: "A couple at the edge of a lake at sunset, with mountains that move as you scroll.",
    opening: "Evening mist clears and the lake, the mountains and the two of you come into focus.",
    openLabel: "Tap to open",
    featured: true,
    couple: ["Ethan", "Lily"],
    date: "2027-04-14T16:30:00+05:30",
    dateLabel: "14 April 2027",
    hosts: "Together with their families",
    request: "invite you to their wedding by the lake",
    story: "We found this lake on a wrong turn four summers ago and promised we would come back. We would love you to be there when we do.",
    events: [
      { title: "Welcome dinner", day: "Tuesday, 13 April", time: "7:00 pm", place: "The Boathouse, Lakewater Lodge" },
      { title: "Ceremony", day: "Wednesday, 14 April", time: "4:30 pm", place: "The Lakeside Terrace, Lakewater Lodge" },
      { title: "Dinner & dancing", day: "Wednesday, 14 April", time: "7:00 pm", place: "The Great Room, Lakewater Lodge" },
    ],
    venue: { name: "Lakewater Lodge", address: "Naukuchiatal Lake Road", city: "Nainital, Uttarakhand" },
    closing: "Stay for the sunset. It is the best part.",
    theme: {
      bg: "#FCF3EA", bgAlt: "#F6E3D4", ink: "#59342A", soft: "#93695A", accent: "#BC8858", tint: "#EFB99A",
      script: "allura", caps: "cormorant", motif: "sprig", frame: "arch", family: "scenic",
      heroTop: 19, heroInk: "#6B3526", plinth: "#F3D9C6",
    },
  },
];

/** "Aarav & Meera", or a single name when there is one host. */
export const pairOf = (t: Pick<Template, "couple">) => (t.couple[1] ? `${t.couple[0]} & ${t.couple[1]}` : t.couple[0]);
/** Script lettering shrinks for long names so it never runs off the screen. */
export const nameScale = (t: Pick<Template, "couple">) => {
  const longest = Math.max(t.couple[0].length, t.couple[1].length);
  return longest <= 8 ? 1 : Math.max(0.5, 8.4 / longest);
};
/** On the first screen a long name of several words is lettered on two lines, split where the lines come out most even. */
export const nameLines = (name: string): string[] => {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.length <= 13 || !n.includes(" ")) return [n];
  const words = n.split(" ");
  let best = [n];
  let bestLen = n.length;
  for (let i = 1; i < words.length; i++) {
    const pair = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const len = Math.max(pair[0].length, pair[1].length);
    if (len < bestLen) [best, bestLen] = [pair, len];
  }
  return best;
};
/** Starting size for the first-screen names, before they are measured against the artwork. */
export const heroNameScale = (t: Pick<Template, "couple">) => {
  const longest = Math.max(1, ...t.couple.flatMap(nameLines).map((l) => l.length));
  return longest <= 8 ? 1 : Math.max(0.42, 8.4 / longest);
};

export const FEATURED = TEMPLATES.filter((t) => t.featured);

export function getTemplate(slug: string): Template | undefined {
  return TEMPLATES.find((t) => t.slug === slug);
}

export function templatesIn(category: Category | "All"): Template[] {
  return category === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.filters.includes(category));
}
