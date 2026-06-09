// =============================================================================
// App-wide tunable constants and display labels.
// Keep refill-prediction knobs here so they're easy to adjust in one place.
// =============================================================================

// A refill is "due soon" if its predicted next purchase date falls within this
// many days from today. Change here to make the "To contact" list wider/tighter.
export const REFILL_WINDOW_DAYS = 7;

// When a customer has bought a consumable only ONCE (no interval to measure),
// fall back to a per-category default cadence in days.
export const CATEGORY_DEFAULT_DAYS: Record<string, number> = {
  food: 30,
  litter: 30,
};
export const FALLBACK_DEFAULT_DAYS = 45; // everything else consumable

export function categoryDefaultDays(category: string): number {
  return CATEGORY_DEFAULT_DAYS[category.toLowerCase()] ?? FALLBACK_DEFAULT_DAYS;
}

// ---- Display label maps for enums (so the UI reads nicely) ----

export const STORE_LABELS: Record<string, string> = {
  KL: "Kuala Lumpur",
  PJ: "Petaling Jaya",
  NONE: "No preference",
};

export const SPECIES_LABELS: Record<string, string> = {
  DOG: "Dog",
  CAT: "Cat",
  OTHER: "Other",
};

export const LIFESTAGE_LABELS: Record<string, string> = {
  PUPPY_KITTEN: "Puppy / Kitten",
  ADULT: "Adult",
  SENIOR: "Senior",
  ANY: "Any",
};

export const SUPPLIER_LABELS: Record<string, string> = {
  TRADING: "Trading",
  CONSIGNMENT: "Consignment",
  INHOUSE: "In-house",
};

export const SUPPLIER_COLORS: Record<string, string> = {
  INHOUSE: "#16a34a", // green — strategic priority
  CONSIGNMENT: "#2563eb", // blue
  TRADING: "#f59e0b", // amber — low margin
  UNCLASSIFIED: "#9ca3af", // grey
};

export const SOURCE_LABELS: Record<string, string> = {
  STOREHUB: "StoreHub",
  WHATSAPP: "WhatsApp",
  WALKIN: "Walk-in",
  TYPEFORM: "Typeform",
  OTHER: "Other",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
};

// ---- WhatsApp lead labels & styles ----

export const LEAD_TYPE_LABELS: Record<string, string> = {
  ORDER: "Order",
  REFILL: "Refill",
  PURCHASE_INTENT: "Purchase intent",
  INQUIRY: "Inquiry",
  COMPLAINT: "Complaint",
  OTHER: "Other",
};

export const LEAD_TYPE_STYLES: Record<string, string> = {
  ORDER: "bg-green-100 text-green-700",
  REFILL: "bg-emerald-100 text-emerald-700",
  PURCHASE_INTENT: "bg-blue-100 text-blue-700",
  INQUIRY: "bg-slate-100 text-slate-600",
  COMPLAINT: "bg-red-100 text-red-700",
  OTHER: "bg-slate-100 text-slate-500",
};

export const LEAD_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  DISMISSED: "Dismissed",
};
