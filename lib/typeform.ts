// =============================================================================
// Typeform → CRM ingestion — tuned to "Haiwan's Membership Registration".
//
// Typeform pushes a `form_response` webhook per submission. Customer fields are
// matched by their stable refs (phone_number / cust_name / cust_email /
// preferred_store / marketing_consent) with a title fallback. Pets are repeated
// up to 10 times with titles "Pet N — <Field>", so we group answers by the pet
// number parsed from the title (refs vary for pets 4-10, titles don't).
//
// Webhook payload reference:
//   https://www.typeform.com/developers/webhooks/example-payload/
// =============================================================================

import { prisma } from "./db";
import { normalizePhone } from "./phone";
import { findExistingCustomer, buildEnrichment } from "./customer-resolve";

interface TFField {
  ref?: string;
  type?: string;
  title?: string;
}
interface TFAnswer {
  field?: { ref?: string; type?: string };
  type?: string;
  text?: string;
  email?: string;
  phone_number?: string;
  number?: number;
  boolean?: boolean;
  date?: string;
  choice?: { label?: string };
  choices?: { labels?: string[] };
}
interface TFFormResponse {
  token?: string;
  definition?: { fields?: TFField[] };
  answers?: TFAnswer[];
}

function answerValue(a: TFAnswer): string | null {
  switch (a.type) {
    case "text":
      return a.text ?? null;
    case "email":
      return a.email ?? null;
    case "phone_number":
      return a.phone_number ?? null;
    case "number":
      return a.number != null ? String(a.number) : null;
    case "boolean":
      return a.boolean != null ? String(a.boolean) : null;
    case "date":
      return a.date ?? null;
    case "choice":
      return a.choice?.label ?? null;
    case "choices":
      return (a.choices?.labels ?? []).join(", ") || null;
    default:
      return a.text ?? a.email ?? a.phone_number ?? null;
  }
}

export interface ParsedPet {
  name: string;
  species: "DOG" | "CAT" | "OTHER";
  breed: string | null;
  sex: "MALE" | "FEMALE" | null;
  neutered: boolean;
  lifeStage: "PUPPY_KITTEN" | "ADULT" | "SENIOR" | null;
  dateOfBirth: string | null;
  weightKg: number | null;
  allergies: string | null;
  dietaryNotes: string | null;
}
export interface ParsedSubmission {
  token: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  preferredStore: "KL" | "PJ" | "NONE";
  marketingConsent: boolean;
  pets: ParsedPet[];
}

const mapSpecies = (v: string | undefined): "DOG" | "CAT" | "OTHER" => {
  const s = (v ?? "").toLowerCase();
  return /dog|puppy|anjing/.test(s) ? "DOG" : /cat|kitten|kucing/.test(s) ? "CAT" : "OTHER";
};
const mapSex = (v: string | undefined): "MALE" | "FEMALE" | null => {
  const s = (v ?? "").toLowerCase();
  return /female|girl/.test(s) ? "FEMALE" : /male|boy/.test(s) ? "MALE" : null;
};
const mapLifeStage = (v: string | undefined): "PUPPY_KITTEN" | "ADULT" | "SENIOR" | null => {
  const s = (v ?? "").toLowerCase();
  if (/baby|puppy|kitten/.test(s)) return "PUPPY_KITTEN";
  if (/senior/.test(s)) return "SENIOR";
  if (/adult/.test(s)) return "ADULT";
  return null;
};

export function parseTypeformResponse(payload: unknown): ParsedSubmission | null {
  const fr = (payload as { form_response?: TFFormResponse })?.form_response;
  if (!fr?.answers?.length) return null;

  const titleByRef = new Map<string, string>();
  for (const f of fr.definition?.fields ?? []) {
    if (f.ref) titleByRef.set(f.ref, (f.title ?? "").toLowerCase());
  }

  type Item = { ref: string; title: string; value: string };
  const items: Item[] = [];
  for (const a of fr.answers) {
    const ref = a.field?.ref ?? "";
    const value = answerValue(a);
    if (value != null && value !== "") items.push({ ref, title: titleByRef.get(ref) ?? "", value });
  }

  const byRefOrTitle = (ref: string, titleRe: RegExp): string | null => {
    const r = items.find((i) => i.ref === ref);
    if (r) return r.value;
    return items.find((i) => titleRe.test(i.title) && !/pet\s*\d/.test(i.title))?.value ?? null;
  };

  const phone = byRefOrTitle("phone_number", /phone|contact|whatsapp|mobile/);
  const name = byRefOrTitle("cust_name", /^name|full name|customer/);
  const email = byRefOrTitle("cust_email", /e-?mail/);
  const storeRaw = byRefOrTitle("preferred_store", /preferred store|\bstore\b/) ?? "";
  const consentRaw = byRefOrTitle("marketing_consent", /marketing|consent|promo/) ?? "";

  const preferredStore: "KL" | "PJ" | "NONE" = /\bkl|kuala/i.test(storeRaw)
    ? "KL"
    : /\bpj|petaling/i.test(storeRaw)
      ? "PJ"
      : "NONE";
  const marketingConsent = /agree|yes|true|subscribe/i.test(consentRaw);

  // Group pet answers by the number in "Pet N — Field".
  const groups = new Map<number, Record<string, string>>();
  const petTitle = /pet\s*(\d+)\s*[—–-]\s*(.+)/;
  for (const i of items) {
    const m = i.title.match(petTitle);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    const field = m[2];
    const g = groups.get(n) ?? {};
    if (/name/.test(field)) g.name = i.value;
    else if (/species/.test(field)) g.species = i.value;
    else if (/breed/.test(field)) g.breed = i.value;
    else if (/\bsex\b|gender/.test(field)) g.sex = i.value;
    else if (/neuter|spay/.test(field)) g.neutered = i.value;
    else if (/life ?stage/.test(field)) g.lifeStage = i.value;
    else if (/birth|dob/.test(field)) g.dob = i.value;
    else if (/weight/.test(field)) g.weight = i.value;
    else if (/allerg/.test(field)) g.allergies = i.value;
    else if (/dietary|diet/.test(field)) g.dietary = i.value;
    groups.set(n, g);
  }

  const pets: ParsedPet[] = [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, g]) => g)
    .filter((g) => g.name && g.name.trim())
    .map((g) => ({
      name: g.name.trim(),
      species: mapSpecies(g.species),
      breed: g.breed?.trim() || null,
      sex: mapSex(g.sex),
      neutered: /yes|true/i.test(g.neutered ?? ""),
      lifeStage: mapLifeStage(g.lifeStage),
      dateOfBirth: g.dob || null,
      weightKg: g.weight && !Number.isNaN(parseFloat(g.weight)) ? parseFloat(g.weight) : null,
      allergies: g.allergies?.trim() || null,
      dietaryNotes: g.dietary?.trim() || null,
    }));

  return { token: fr.token ?? "", name, phone, email, preferredStore, marketingConsent, pets };
}

/** Create/link the customer and their pets from a parsed submission. */
export async function ingestTypeformSubmission(
  parsed: ParsedSubmission,
): Promise<{ customerId: string; created: boolean; petsCreated: number }> {
  const phone = parsed.phone ? normalizePhone(parsed.phone) : null;

  // Match an existing customer by phone, then email — so a person already in the
  // CRM (e.g. created from a StoreHub sale earlier) is enriched, not duplicated.
  let customer = await findExistingCustomer({ phone, email: parsed.email });
  let created = false;
  if (customer) {
    const data = buildEnrichment(
      customer,
      {
        name: parsed.name,
        email: parsed.email,
        preferredStore: parsed.preferredStore,
        marketingConsent: parsed.marketingConsent,
      },
      phone,
    );
    if (Object.keys(data).length) customer = await prisma.customer.update({ where: { id: customer.id }, data });
  } else {
    const key = phone ?? `tf:${parsed.token || Math.random().toString(36).slice(2)}`;
    customer = await prisma.customer.create({
      data: {
        phone: key,
        name: parsed.name,
        email: parsed.email,
        preferredStore: parsed.preferredStore,
        source: "TYPEFORM",
        needsDetails: !phone,
        marketingConsent: parsed.marketingConsent,
        consentDate: parsed.marketingConsent ? new Date() : null,
        notes: "Imported from Typeform membership registration.",
      },
    });
    created = true;
  }

  let petsCreated = 0;
  for (const p of parsed.pets) {
    const dup = await prisma.pet.findFirst({ where: { customerId: customer.id, name: p.name } });
    if (dup) continue;
    await prisma.pet.create({
      data: {
        customerId: customer.id,
        name: p.name,
        species: p.species,
        breed: p.breed,
        sex: p.sex,
        neutered: p.neutered,
        lifeStage: p.lifeStage,
        dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
        weightKg: p.weightKg,
        allergies: p.allergies,
        dietaryNotes: p.dietaryNotes,
        notes: "From Typeform submission.",
      },
    });
    petsCreated++;
  }

  return { customerId: customer.id, created, petsCreated };
}
