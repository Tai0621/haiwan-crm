// =============================================================================
// Typeform → CRM ingestion.
//
// Typeform pushes a `form_response` webhook on every submission. The payload
// carries the question definitions (with titles) and the answers (joined by a
// field ref). We map questions to CRM fields HEURISTICALLY by matching the
// question title (and answer type) — robust to most "customer + pet details"
// forms, and easy to tune once we see the real form.
//
// Webhook payload reference:
//   https://www.typeform.com/developers/webhooks/example-payload/
// =============================================================================

import { prisma } from "./db";
import { normalizePhone } from "./phone";

interface TFField {
  id?: string;
  ref?: string;
  type?: string;
  title?: string;
}
interface TFAnswer {
  field?: { id?: string; ref?: string; type?: string };
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
  form_id?: string;
  token?: string;
  submitted_at?: string;
  definition?: { fields?: TFField[] };
  answers?: TFAnswer[];
}
interface TFWebhook {
  event_type?: string;
  form_response?: TFFormResponse;
}

/** Read the value out of an answer regardless of its type. */
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

export interface ParsedSubmission {
  token: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  marketingConsent: boolean;
  pet: {
    name: string | null;
    species: "DOG" | "CAT" | "OTHER" | null;
    breed: string | null;
    sex: "MALE" | "FEMALE" | null;
  };
  raw: Array<{ title: string; value: string }>;
}

export function parseTypeformResponse(payload: unknown): ParsedSubmission | null {
  const fr = (payload as TFWebhook)?.form_response;
  if (!fr?.answers?.length) return null;

  const titleByRef = new Map<string, string>();
  for (const f of fr.definition?.fields ?? []) {
    if (f.ref) titleByRef.set(f.ref, (f.title ?? "").toLowerCase());
  }

  const items: Array<{ title: string; type: string; value: string }> = [];
  for (const a of fr.answers) {
    const title = (a.field?.ref && titleByRef.get(a.field.ref)) || "";
    const value = answerValue(a);
    if (value != null && value !== "") items.push({ title, type: a.type ?? "", value });
  }

  const find = (re: RegExp, exclude?: RegExp): string | null =>
    items.find((i) => re.test(i.title) && (!exclude || !exclude.test(i.title)))?.value ?? null;
  const findByType = (t: string): string | null => items.find((i) => i.type === t)?.value ?? null;

  const petish = /pet|dog|cat|fur ?kid|fur ?baby|anabul|haiwan/;

  const phone =
    find(/phone|contact|whatsapp|\bhp\b|mobile|no\.? ?tel|number/) ?? findByType("phone_number");
  const email = find(/e-?mail/) ?? findByType("email");
  const name =
    find(/your name|full name|owner|parent|customer/, petish) ?? find(/\bname\b/, petish);

  const petName = find(/(pet|dog|cat|fur ?kid|fur ?baby|anabul).{0,12}name|name.{0,6}(pet|dog|cat)/);
  const speciesRaw = find(/species|dog or cat|cat or dog|type of (pet|animal)|pet type|dog\/cat/);
  const breedRaw = find(/breed/);
  const sexRaw = find(/gender|\bsex\b/);

  let species: "DOG" | "CAT" | "OTHER" | null = null;
  const speciesHint = (speciesRaw ?? `${petName ?? ""} ${breedRaw ?? ""}`).toLowerCase();
  if (speciesRaw || petName) {
    species = /\b(dog|puppy|anjing|doggo)\b/.test(speciesHint)
      ? "DOG"
      : /\b(cat|kitten|kucing|feline)\b/.test(speciesHint)
        ? "CAT"
        : speciesRaw
          ? "OTHER"
          : null;
  }

  let sex: "MALE" | "FEMALE" | null = null;
  if (sexRaw) {
    const s = sexRaw.toLowerCase();
    sex = /female|girl/.test(s) ? "FEMALE" : /male|boy/.test(s) ? "MALE" : null;
  }

  const consentRaw = find(/consent|marketing|subscribe|updates|promo|newsletter|pdpa/);
  const marketingConsent = consentRaw != null && /yes|true|agree|ok|subscribe|setuju/i.test(consentRaw);

  return {
    token: fr.token ?? "",
    name,
    phone,
    email,
    marketingConsent,
    pet: { name: petName, species, breed: breedRaw, sex },
    raw: items.map((i) => ({ title: i.title, value: i.value })),
  };
}

/** Create/link the customer and (optionally) their pet from a parsed submission. */
export async function ingestTypeformSubmission(
  parsed: ParsedSubmission,
): Promise<{ customerId: string; created: boolean; petCreated: boolean }> {
  const phone = parsed.phone ? normalizePhone(parsed.phone) : null;
  // Identity key: real phone if given, else a stable placeholder from the token.
  const key = phone ?? `tf:${parsed.token || cryptoRandom()}`;

  let customer = await prisma.customer.findUnique({ where: { phone: key } });
  let created = false;
  if (customer) {
    const data: { name?: string; email?: string; marketingConsent?: boolean; consentDate?: Date } = {};
    if (!customer.name && parsed.name) data.name = parsed.name;
    if (!customer.email && parsed.email) data.email = parsed.email;
    if (parsed.marketingConsent && !customer.marketingConsent) {
      data.marketingConsent = true;
      data.consentDate = new Date();
    }
    if (Object.keys(data).length) customer = await prisma.customer.update({ where: { id: customer.id }, data });
  } else {
    customer = await prisma.customer.create({
      data: {
        phone: key,
        name: parsed.name,
        email: parsed.email,
        source: "TYPEFORM",
        needsDetails: !phone,
        marketingConsent: parsed.marketingConsent,
        consentDate: parsed.marketingConsent ? new Date() : null,
        notes: "Imported from Typeform.",
      },
    });
    created = true;
  }

  // Pet — only if the form captured something pet-shaped.
  let petCreated = false;
  if (parsed.pet.name || parsed.pet.species || parsed.pet.breed) {
    const petName =
      parsed.pet.name ??
      (parsed.pet.species === "CAT" ? "Cat" : parsed.pet.species === "DOG" ? "Dog" : "Pet");
    const dup = await prisma.pet.findFirst({ where: { customerId: customer.id, name: petName } });
    if (!dup) {
      await prisma.pet.create({
        data: {
          customerId: customer.id,
          name: petName,
          species: parsed.pet.species ?? "OTHER",
          breed: parsed.pet.breed,
          sex: parsed.pet.sex,
          notes: "From Typeform submission.",
        },
      });
      petCreated = true;
    }
  }

  return { customerId: customer.id, created, petCreated };
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
