/** Sharing helpers. WhatsApp is used only to share a published invitation, never to buy one. */

export function shareText(names: string, dateLabel: string, url: string, greeting?: string) {
  return [greeting ? `Dear ${greeting},` : null, greeting ? "" : null, "You’re invited 💛", "", names, dateLabel, "", "Open the invitation:", url].filter((l) => l !== null).join("\n");
}

/** WhatsApp share link. With a phone number it opens that chat; without one, WhatsApp asks who to send it to. */
export function whatsappShare(text: string, phone?: string) {
  const digits = (phone || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function mailShare(subject: string, text: string, to = "") {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export type CalendarEvent = { title: string; startIso: string; location: string; description: string; url?: string };

/** An .ics file guests can add to any calendar. Events are given three hours. */
export function icsFile(e: CalendarEvent): string {
  const end = new Date(new Date(e.startIso).getTime() + 3 * 3600_000).toISOString();
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//YoureIn//Invitation//EN",
    "BEGIN:VEVENT",
    `UID:${stamp(e.startIso)}-${Math.random().toString(36).slice(2)}@yourein`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.startIso)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(e.location)}`,
    `DESCRIPTION:${esc(e.description + (e.url ? `\n${e.url}` : ""))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function googleCalendarUrl(e: CalendarEvent) {
  const end = new Date(new Date(e.startIso).getTime() + 3 * 3600_000).toISOString();
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${stamp(e.startIso)}/${stamp(end)}`, location: e.location, details: e.description + (e.url ? `\n${e.url}` : "") });
  return `https://calendar.google.com/calendar/render?${q}`;
}
