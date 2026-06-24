// =============================================================================
// WhatsApp message template library (Phase 1).
//
// Staff send messages by hand via click-to-chat (wa.me) — there is NO WhatsApp
// API here. Each template merges in the customer/pet/product and returns plain
// text that the inbox passes to whatsappLink() so the staffer can review and
// send. Keep the voice warm and on-brand ("Haiwan — another parent to every
// pet."). Templates that belong to later phases (activation, win-back, birthday)
// are baked in now so they're ready when those phases light up.
// =============================================================================

import type { TaskType } from "../app/generated/prisma/client";

export interface TemplateContext {
  customerName?: string | null;
  petName?: string | null;
  petNames?: string[];
  productName?: string | null;
  holdItem?: string | null;
}

/** "Aishah" → " Aishah"; null/empty → "" (so "Hi{x}!" reads cleanly). */
function greet(name?: string | null): string {
  const n = (name ?? "").trim();
  return n ? ` ${n}` : "";
}

/** "Mochi & Oreo's" / "your pet's" — possessive subject for refill-style msgs. */
function petsPossessive(ctx: TemplateContext): string {
  const names = ctx.petNames?.filter(Boolean) ?? (ctx.petName ? [ctx.petName] : []);
  if (names.length === 0) return "your pet's";
  return `${names.join(" & ")}'s`;
}

/** "Mochi" / "your pet" — subject for birthday-style msgs. */
function petSubject(ctx: TemplateContext): string {
  const names = ctx.petNames?.filter(Boolean) ?? (ctx.petName ? [ctx.petName] : []);
  return names.length ? names.join(" & ") : "your pet";
}

// --- The templates ----------------------------------------------------------

export const TEMPLATES = {
  /** REFILL — a consumable predicted to run low. */
  refillNudge(ctx: TemplateContext): string {
    const product = ctx.productName ?? "their usual food";
    return `Hi${greet(ctx.customerName)}! This is Haiwan. We think ${petsPossessive(ctx)} ${product} may be running low soon — would you like us to set aside a refill for you?`;
  },

  /** HOLD active — remind a customer their reserved item is waiting (SOP §6). */
  holdReserved(ctx: TemplateContext): string {
    const item = ctx.holdItem ?? ctx.productName ?? "the item you asked about";
    return `Hi${greet(ctx.customerName)}! This is Haiwan. We've reserved ${item} for you and will hold it for 24 hours. Just let us know if you'd like us to keep it longer or arrange a pickup 🐾`;
  },

  /** HOLD lapse — a 24h reservation expired before it was collected (SOP §6). */
  holdLapse(ctx: TemplateContext): string {
    const item = ctx.holdItem ?? ctx.productName ?? "the item you reserved";
    return `Hi${greet(ctx.customerName)}! This is Haiwan. We held ${item} for you for 24 hours and have now released it back to the shelf. No worries at all — just let us know and we'll happily reserve it again for you.`;
  },

  /** LEAD_FOLLOWUP — chase a walk-in who asked about an item (SOP §5). */
  leadFollowup(ctx: TemplateContext): string {
    const item = ctx.productName ?? ctx.holdItem ?? "the item you asked about";
    return `Hi${greet(ctx.customerName)}! This is Haiwan, following up on ${item} you asked about. We'd love to help — would you like us to set one aside, or share a few options for ${petSubject(ctx)}?`;
  },

  /** INQUIRY first-reply — acknowledge an inbound question quickly. */
  firstReply(ctx: TemplateContext): string {
    return `Hi${greet(ctx.customerName)}! Thanks for reaching out to Haiwan 🐾 We've received your message and someone from our team will get back to you shortly. Is there anything specific about ${petSubject(ctx)} we can help with?`;
  },

  /** ACTIVATION — invite a past customer to claim their membership (Phase 2). */
  activation(ctx: TemplateContext): string {
    return `Hi${greet(ctx.customerName)}! This is Haiwan. As one of our valued pet parents, you're invited to claim your Haiwan membership — it's free and unlocks member pricing and refill reminders for ${petSubject(ctx)}. Shall we set it up for you?`;
  },

  /** WINBACK — re-engage a customer who's gone quiet (Phase 2). */
  winback(ctx: TemplateContext): string {
    return `Hi${greet(ctx.customerName)}! We've missed you and ${petSubject(ctx)} at Haiwan 🐾 It's been a little while — can we help with a refill or anything they need? We'd love to welcome you back.`;
  },

  /** PET_BIRTHDAY — a warm on-brand birthday note (Phase 2). */
  petBirthday(ctx: TemplateContext): string {
    return `Happy birthday to ${petSubject(ctx)}! 🎂🐾 From all of us at Haiwan — another parent to every pet. Pop by anytime${greet(ctx.customerName) ? "," + greet(ctx.customerName) : ""} for a little birthday treat on us.`;
  },
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

/** Map a Task's type to the most appropriate template key. */
export function templateKeyForTask(type: TaskType): TemplateKey {
  switch (type) {
    case "REFILL":
    case "SUBSCRIPTION_DUE":
      return "refillNudge";
    case "HOLD":
      return "holdLapse";
    case "LEAD_FOLLOWUP":
      return "leadFollowup";
    case "INQUIRY":
      return "firstReply";
    case "ACTIVATION":
      return "activation";
    case "WINBACK":
      return "winback";
    default:
      return "leadFollowup";
  }
}

/** Build the message text for a given template key + context. */
export function renderTemplate(key: TemplateKey, ctx: TemplateContext): string {
  return TEMPLATES[key](ctx);
}
