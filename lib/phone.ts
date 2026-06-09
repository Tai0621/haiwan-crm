// =============================================================================
// Phone number normalisation (international, Malaysia-default).
//
// The phone number is the CRM's identity key. Every customer phone — whether
// typed by staff or imported from StoreHub — is run through normalizePhone()
// before storing or matching, so the same person always resolves to one record.
//
// Canonical form: country code + national number, digits only, no "+".
//
// How a number's country is decided:
//   • If it carries an explicit country code — a leading "+" or "00" — that is
//     trusted as-is, so customers anywhere in the world store correctly.
//   • Otherwise we assume the home market (Malaysia, +60), which keeps staff
//     entry for local customers as simple as before.
//
//   e.g.  "012-345 6789"      ->  "60123456789"   (local, no code -> +60)
//         "0123456789"        ->  "60123456789"   (local, no code -> +60)
//         "+60 12-345 6789"   ->  "60123456789"   (explicit +60)
//         "+1 415 555 1234"   ->  "14155551234"   (explicit +1, US)
//         "+44 7700 900123"   ->  "447700900123"  (explicit +44, UK)
//         "001 415 555 1234"  ->  "14155551234"   (00 intl prefix)
// =============================================================================

/**
 * Normalise a phone number to canonical "<countrycode><national>" form
 * (digits only, no "+"). International numbers must carry their country code via
 * a leading "+" or "00"; numbers without one are treated as Malaysian (+60).
 * Returns null if the input has no usable digits.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Did the user give an explicit international country code?
  const hasPlus = raw.trimStart().startsWith("+");

  // Strip everything except digits.
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;

  // Explicit "+<code><number>" -> trust the country code exactly as given.
  if (hasPlus) return digits;

  // "00" is the international call prefix in much of the world -> drop it and
  // trust the remaining "<code><number>".
  if (digits.startsWith("00")) {
    const rest = digits.slice(2);
    return rest.length ? rest : null;
  }

  // No country code given — assume the home market (Malaysia, +60).
  // Already in "60..." country-code form -> keep as-is.
  if (digits.startsWith("60")) return digits;

  // Local national format with leading "0" -> swap for "60".
  if (digits.startsWith("0")) return "60" + digits.slice(1);

  // Bare national number without leading 0 (e.g. "123456789") -> prepend "60".
  return "60" + digits;
}

/**
 * Format a canonical phone for display: "+60 12-345 6789" style (best-effort).
 * Falls back to the raw canonical string if it doesn't look Malaysian.
 */
export function formatPhoneDisplay(canonical: string | null | undefined): string {
  if (!canonical) return "—";
  // Placeholder key for a WhatsApp contact whose number we couldn't recover
  // (saved contact — WhatsApp omits the number from exports). See lib/whatsapp.
  if (canonical.startsWith("wa:")) return "No number yet";
  // Non-Malaysian numbers: show as "+<digits>" (we don't carry per-country
  // grouping rules, so a clean E.164-style "+" prefix is the safe display).
  if (!canonical.startsWith("60")) return `+${canonical}`;
  const national = canonical.slice(2); // drop "60"
  // e.g. 123456789 -> 12-345 6789  /  1123456789 -> 11-2345 6789
  if (national.length >= 9) {
    const prefix = national.slice(0, national.length - 7);
    const mid = national.slice(national.length - 7, national.length - 4);
    const last = national.slice(national.length - 4);
    return `+60 ${prefix}-${mid} ${last}`;
  }
  return `+${canonical}`;
}

/**
 * Build a WhatsApp click-to-chat URL from a canonical phone.
 * wa.me requires digits only, no "+".
 */
export function whatsappLink(canonical: string | null | undefined, text?: string): string | null {
  if (!canonical || canonical.startsWith("wa:")) return null; // placeholder — no real number
  const base = `https://wa.me/${canonical}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
