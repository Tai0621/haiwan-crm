// =============================================================================
// Malaysian phone number normalisation.
//
// The phone number is the CRM's identity key. Every customer phone — whether
// typed by staff or imported from StoreHub — is run through normalizePhone()
// before storing or matching, so the same person always resolves to one record.
//
// Canonical form: country code + national number, digits only, no "+".
//   e.g.  "012-345 6789"  ->  "60123456789"
//         "+60123456789"  ->  "60123456789"
//         "0123456789"    ->  "60123456789"
// =============================================================================

/**
 * Normalise a Malaysian phone number to canonical "60XXXXXXXXX" form.
 * Returns null if the input has no usable digits.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Strip everything except digits and a leading +
  let digits = raw.replace(/[^\d+]/g, "");

  // Drop a leading "+"
  if (digits.startsWith("+")) digits = digits.slice(1);

  if (digits.length === 0) return null;

  // Already has country code "60..." -> keep as-is
  if (digits.startsWith("60")) {
    return digits;
  }

  // Leading "0" (national format) -> replace with "60"
  if (digits.startsWith("0")) {
    return "60" + digits.slice(1);
  }

  // Bare national number without leading 0 (e.g. "123456789") -> prepend "60"
  return "60" + digits;
}

/**
 * Format a canonical phone for display: "+60 12-345 6789" style (best-effort).
 * Falls back to the raw canonical string if it doesn't look Malaysian.
 */
export function formatPhoneDisplay(canonical: string | null | undefined): string {
  if (!canonical) return "—";
  if (!canonical.startsWith("60")) return canonical;
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
  if (!canonical) return null;
  const base = `https://wa.me/${canonical}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
