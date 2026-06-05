// =============================================================================
// WhatsApp "Export chat" (.txt) parser — the manual ingestion fallback.
//
// In WhatsApp: open a chat → ⋮/contact → "Export chat" → "Without media".
// That produces a .txt the user pastes into the CRM importer. Two common
// layouts are handled:
//
//   iOS:      [01/06/2024, 14:32:05] Aishah: Hi, nak order kibble
//   Android:  01/06/2024, 14:32 - Aishah: Hi, nak order kibble
//
// Notes / limitations:
//   • Exports contain DISPLAY NAMES, not phone numbers. So the importer asks
//     the user for the customer's phone and which sender name is "us" (Haiwan);
//     this parser just returns entries + the distinct sender names.
//   • Continuation lines (multi-line messages) have no timestamp and are
//     appended to the previous entry.
//   • Dates are parsed DAY-FIRST (DD/MM/YYYY), matching Malaysian locale.
// =============================================================================

export interface ParsedEntry {
  timestamp: Date;
  sender: string;
  body: string;
}

export interface ParseResult {
  entries: ParsedEntry[];
  /** Distinct sender names, most frequent first — for the "which one is us?" picker. */
  senders: string[];
  /** Lines that looked like messages but couldn't be parsed (for user feedback). */
  unparsed: number;
}

// A header line begins a new message. Capture: date, time, sender, rest-of-line.
// Optional leading "[", optional trailing "]" before the sender, " - " or "] "
// separator. ‎/‏ are LTR/RTL marks WhatsApp sprinkles in — stripped first.
const HEADER = new RegExp(
  "^\\[?" +
    "(\\d{1,4}[./-]\\d{1,2}[./-]\\d{1,4})" + // date
    ",?\\s+" +
    "(\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:[APap][Mm])?)" + // time
    "\\]?" +
    "\\s*(?:-|–)?\\s*" + // android " - " separator (optional)
    "([^:]{1,80}?):\\s" + // sender (up to first ": ")
    "([\\s\\S]*)$", // body (rest of this line)
);

/** Parse a chat date + time into a Date (day-first). Returns null on failure. */
function parseChatDate(dateStr: string, timeStr: string): Date | null {
  const dm = dateStr.match(/^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})$/);
  if (!dm) return null;
  let [, a, b, cRaw] = dm;
  let day: number, month: number, year: number;

  // If the first group is 4 digits it's YYYY/MM/DD; otherwise DD/MM/YYYY.
  if (a.length === 4) {
    year = parseInt(a);
    month = parseInt(b);
    day = parseInt(cRaw);
  } else {
    day = parseInt(a);
    month = parseInt(b);
    year = parseInt(cRaw);
    if (year < 100) year += 2000;
    // Guard the rare MM/DD export: if "day" can't be a day but could be a month, swap.
    if (day > 31 && month <= 12) {
      [day, month] = [month, day];
    }
  }

  const tm = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap][Mm])?$/);
  if (!tm) return null;
  let hh = parseInt(tm[1]);
  const min = parseInt(tm[2]);
  const sec = tm[3] ? parseInt(tm[3]) : 0;
  const ampm = tm[4]?.toLowerCase();
  if (ampm === "pm" && hh < 12) hh += 12;
  if (ampm === "am" && hh === 12) hh = 0;

  const d = new Date(year, month - 1, day, hh, min, sec);
  return isNaN(d.getTime()) ? null : d;
}

// System notices that aren't real conversation — skipped when they appear as
// their own (sender-less) header. Real messages always have a "sender: body".
const SYSTEM_HINTS = [
  "end-to-end encrypted",
  "changed their phone number",
  "changed the group",
  "created group",
  "added you",
  "security code changed",
];

export function parseWhatsAppExport(text: string): ParseResult {
  // Strip BOM and directionality marks that break the regexes.
  const clean = text.replace(/﻿/g, "").replace(/[‎‏‪-‮]/g, "");
  const lines = clean.split(/\r?\n/);

  const entries: ParsedEntry[] = [];
  const senderCounts = new Map<string, number>();
  let unparsed = 0;

  for (const line of lines) {
    if (line.trim() === "") {
      // blank line inside a message — keep as part of the body
      if (entries.length > 0) entries[entries.length - 1].body += "\n";
      continue;
    }

    const m = line.match(HEADER);
    if (m) {
      const [, dateStr, timeStr, senderRaw, body] = m;
      const ts = parseChatDate(dateStr, timeStr);
      const sender = senderRaw.trim();

      // A header whose "sender" is actually a system notice → skip.
      const low = (sender + " " + body).toLowerCase();
      if (ts && SYSTEM_HINTS.some((h) => low.includes(h)) && body.trim() === "") {
        continue;
      }

      if (!ts) {
        unparsed++;
        continue;
      }
      entries.push({ timestamp: ts, sender, body: body });
      senderCounts.set(sender, (senderCounts.get(sender) ?? 0) + 1);
    } else if (entries.length > 0) {
      // Continuation of the previous message.
      entries[entries.length - 1].body += "\n" + line;
    } else {
      unparsed++;
    }
  }

  // Trim trailing whitespace on bodies.
  for (const e of entries) e.body = e.body.trim();

  const senders = Array.from(senderCounts.entries())
    .sort((x, y) => y[1] - x[1])
    .map(([name]) => name);

  return { entries, senders, unparsed };
}
