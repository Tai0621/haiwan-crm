// =============================================================================
// Customer identity resolution — the single place that decides whether an
// incoming customer (from StoreHub, Typeform, WhatsApp, manual entry, …) is
// someone we already have, so the same person never gets two records.
//
// Identity precedence:
//   1. PHONE (canonical "60xxxxxxxxx") — the primary key. Customer.phone is
//      unique, so a phone hit is an exact, unambiguous match.
//   2. EMAIL — a secondary fallback for when a source has no phone (or a phone
//      that doesn't match), e.g. a Typeform with only an email.
//
// `tf:`/`wa:` phones are placeholders for records we created before we knew the
// real number; when a later, richer submission arrives WITH a real phone, the
// placeholder is upgraded so the two collapse into one record.
// =============================================================================

import { prisma } from "./db";

type CustomerRow = NonNullable<Awaited<ReturnType<typeof prisma.customer.findUnique>>>;

function isPlaceholderPhone(phone: string): boolean {
  return phone.startsWith("tf:") || phone.startsWith("wa:");
}

/**
 * Find an existing customer by phone first, then email. Returns null if neither
 * identifier matches anyone. `phone` must already be canonical (or null).
 */
export async function findExistingCustomer(opts: {
  phone: string | null;
  email?: string | null;
}): Promise<CustomerRow | null> {
  if (opts.phone) {
    const byPhone = await prisma.customer.findUnique({ where: { phone: opts.phone } });
    if (byPhone) return byPhone;
  }
  const email = opts.email?.trim();
  if (email) {
    const byEmail = await prisma.customer.findFirst({ where: { email } });
    // Merge on email when we have no phone at all, OR when the email-matched
    // record only has a placeholder phone (so we're upgrading it, not fusing two
    // people who happen to share an email but have distinct real numbers).
    if (byEmail && (!opts.phone || isPlaceholderPhone(byEmail.phone))) return byEmail;
  }
  return null;
}

/** Fields a source may want to merge into an existing customer. */
export interface CustomerPatch {
  name?: string | null;
  email?: string | null;
  preferredStore?: "KL" | "PJ" | "NONE";
  marketingConsent?: boolean;
}

/** Non-destructive update shape (assignable to Prisma's CustomerUpdateInput). */
export interface CustomerEnrichment {
  name?: string;
  email?: string;
  preferredStore?: "KL" | "PJ" | "NONE";
  marketingConsent?: boolean;
  consentDate?: Date;
  phone?: string;
  needsDetails?: boolean;
}

/**
 * Build a non-destructive update for an existing customer: only fills blanks
 * (never overwrites data staff may have edited), upgrades a placeholder phone to
 * a real one, and clears `needsDetails` once the record has a real name + phone.
 * Returns the data object (may be empty — caller can skip the write if so).
 */
export function buildEnrichment(
  existing: CustomerRow,
  patch: CustomerPatch,
  canonicalPhone: string | null,
): CustomerEnrichment {
  const data: CustomerEnrichment = {};

  if (!existing.name && patch.name) data.name = patch.name;
  if (!existing.email && patch.email) data.email = patch.email;
  if (
    patch.preferredStore &&
    patch.preferredStore !== "NONE" &&
    existing.preferredStore === "NONE"
  )
    data.preferredStore = patch.preferredStore;
  if (patch.marketingConsent && !existing.marketingConsent) {
    data.marketingConsent = true;
    data.consentDate = new Date();
  }

  // Upgrade a placeholder phone to the real one (safe: caller only reaches here
  // via an email match, so no record already holds this phone).
  if (canonicalPhone && existing.phone !== canonicalPhone && isPlaceholderPhone(existing.phone)) {
    data.phone = canonicalPhone;
  }

  // No longer a stub once we have a real name and a real (non-placeholder) phone.
  const finalName = data.name ?? existing.name;
  const finalPhone = data.phone ?? existing.phone;
  if (existing.needsDetails && finalName && finalPhone && !isPlaceholderPhone(finalPhone)) {
    data.needsDetails = false;
  }

  return data;
}
