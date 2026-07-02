// =============================================================================
// Opening / closing shift checklist (store readiness + cleanliness SOP).
//
// The checklist is now DATA in the ShiftChecklistItem table — management edits
// it in-app; staff just complete it. This module holds:
//   • the pure types + `buildSections()` grouper used by the (client) checklist,
//   • `defaultSopItems()` — the initial content used to seed a fresh database.
// Pure module — safe to import from client and server.
//
// Branch differences (KL is the base; PJ differs): no alarm, no display cases,
// no entrance mat, ambient music, signage lights at 7pm, electric mop in dock.
// =============================================================================

export type Priority = "high" | "med" | "low";
export type Shift = "OPENING" | "CLOSING";
export type Branch = "KL" | "PJ";
export type Scope = "OPENING" | "CLOSING" | "BOTH";

/** A checklist line as rendered/edited (mirrors ShiftChecklistItem, serializable). */
export interface SopItem {
  id: string;
  section: string;
  sectionOrder: number;
  sortOrder: number;
  shift: Scope;
  label: string;
  note: string | null;
  priority: Priority;
  storeKL: boolean;
  storePJ: boolean;
}

export interface ChecklistSection {
  section: string;
  items: SopItem[];
}

/** The fixed set of sections (for the editor's section picker), in order. */
export const SECTIONS: { title: string; order: number; scope: Scope }[] = [
  { title: "Open the store", order: 0, scope: "OPENING" },
  { title: "Entrance & windows", order: 10, scope: "BOTH" },
  { title: "Display & inventory", order: 20, scope: "BOTH" },
  { title: "Floors", order: 30, scope: "BOTH" },
  { title: "Waste & bins", order: 40, scope: "BOTH" },
  { title: "Counter & till", order: 50, scope: "BOTH" },
  { title: "General store condition", order: 60, scope: "BOTH" },
  { title: "Close the store", order: 70, scope: "CLOSING" },
];

export const PRIORITY_LABELS: Record<Priority, string> = { high: "High", med: "Medium", low: "Low" };
export const SCOPE_LABELS: Record<Scope, string> = { OPENING: "Opening only", CLOSING: "Closing only", BOTH: "Both shifts" };

/**
 * Group items into ordered sections for a given shift + branch. Filters to the
 * shift (matching scope or BOTH) and branch (store flag), orders sections by
 * sectionOrder and items by sortOrder, and drops empty sections.
 */
export function buildSections(items: SopItem[], shift: Shift, branch: Branch): ChecklistSection[] {
  const relevant = items.filter(
    (i) => (i.shift === shift || i.shift === "BOTH") && (branch === "KL" ? i.storeKL : i.storePJ),
  );
  const bySection = new Map<string, { order: number; items: SopItem[] }>();
  for (const i of relevant) {
    if (!bySection.has(i.section)) bySection.set(i.section, { order: i.sectionOrder, items: [] });
    const g = bySection.get(i.section)!;
    g.order = Math.min(g.order, i.sectionOrder);
    g.items.push(i);
  }
  return Array.from(bySection.entries())
    .map(([section, g]) => ({ section, order: g.order, items: g.items.sort((a, b) => a.sortOrder - b.sortOrder) }))
    .sort((a, b) => a.order - b.order)
    .map(({ section, items }) => ({ section, items }));
}

// ---------------------------------------------------------------------------
// Default content used to seed a fresh database. Returns insertable rows
// (no id / timestamps). `k` = both branches, `kl`/`pj` = branch-specific.
// ---------------------------------------------------------------------------
type SeedItem = Omit<SopItem, "id">;

export function defaultSopItems(): SeedItem[] {
  const out: SeedItem[] = [];
  const add = (
    section: string,
    sectionOrder: number,
    shift: Scope,
    label: string,
    priority: Priority,
    opts: { note?: string; kl?: boolean; pj?: boolean } = {},
  ) => {
    out.push({
      section,
      sectionOrder,
      sortOrder: out.filter((o) => o.section === section).length * 10,
      shift,
      label,
      note: opts.note ?? null,
      priority,
      storeKL: opts.kl ?? true,
      storePJ: opts.pj ?? true,
    });
  };

  // Open the store (opening)
  add("Open the store", 0, "OPENING", "Unlock & disarm the alarm", "high", { pj: false });
  add("Open the store", 0, "OPENING", "Unlock the store", "high", { kl: false });
  add("Open the store", 0, "OPENING", "Lights & air-con on", "high");
  add("Open the store", 0, "OPENING", "Turn on ambient music", "med", { kl: false });
  add("Open the store", 0, "OPENING", "POS on, float counted, receipt roll ready", "high", { note: "Confirm the float matches the handover." });
  add("Open the store", 0, "OPENING", "Unlock display cases & doors", "med", { pj: false });
  add("Open the store", 0, "OPENING", "Open sign / A-frame out", "low", { pj: false });
  add("Open the store", 0, "OPENING", "Signage lights on at 7pm", "low", { kl: false, note: "PJ has no open sign — switch the signage lights on at 7pm." });
  add("Open the store", 0, "OPENING", "Pre-open walk-through — store is customer-ready", "med");

  // Entrance & windows
  add("Entrance & windows", 10, "BOTH", "Glass door — wipe fingerprints & smudges (inside & out)", "high", { note: "Glass cleaner + microfibre; focus on handle height and push zones." });
  add("Entrance & windows", 10, "BOTH", "Shop-front windows — streak-free", "high", { note: "Spray and wipe top-to-bottom; check from outside." });
  add("Entrance & windows", 10, "BOTH", "Door frame & sill — wipe dust & grime", "med");
  add("Entrance & windows", 10, "BOTH", "Door handle / push bar — disinfect", "med", { note: "High-touch surface." });
  add("Entrance & windows", 10, "BOTH", "Entrance mat — shake out / vacuum", "low", { pj: false });

  // Display & inventory
  add("Display & inventory", 20, "BOTH", "All items for sale — dust-free", "high", { note: "Soft dry cloth or duster, shelf by shelf, top to bottom." });
  add("Display & inventory", 20, "BOTH", "Check products & packaging for pet fur / lint", "high", { note: "Lint roller on soft goods and plush toys." });
  add("Display & inventory", 20, "BOTH", "Display shelves & surfaces — wiped clean", "high");
  add("Display & inventory", 20, "BOTH", "Products faced & labels forward", "med");
  add("Display & inventory", 20, "BOTH", "Glass display cases — smudge-free inside & out", "med", { pj: false });
  add("Display & inventory", 20, "BOTH", "Signage & price tags — clean & legible", "low");

  // Floors
  add("Floors", 30, "BOTH", "Sweep / vacuum entire floor area", "high", { note: "Include under shelving, corners, and behind fixtures." });
  add("Floors", 30, "BOTH", "Mop floor with the correct cleaner & dilution", "high", { note: "Mop in sections, back-to-front; let it dry fully." });
  add("Floors", 30, "BOTH", "Spot-clean any spills or sticky spots", "med");
  add("Floors", 30, "BOTH", "Skirting boards & floor edges — dust / wipe", "med");
  add("Floors", 30, "BOTH", "Mop & bucket — rinsed, wrung, stored", "low", { pj: false });
  add("Floors", 30, "BOTH", "Electric mop — washed in the dock", "low", { kl: false, note: "Rinse the head and return it to the dock." });

  // Waste & bins
  add("Waste & bins", 40, "BOTH", "Empty all bins & reline", "high", { note: "Tie bag securely; fresh liner immediately." });
  add("Waste & bins", 40, "BOTH", "Dispose of packaging waste & break down cardboard", "high");
  add("Waste & bins", 40, "BOTH", "Wipe bin inside & out with disinfectant", "med");
  add("Waste & bins", 40, "BOTH", "Check back-of-house / stockroom for waste", "med");
  add("Waste & bins", 40, "BOTH", "Confirm waste taken to external collection point", "low", { note: "Nothing left inside overnight." });

  // Counter & till
  add("Counter & till", 50, "BOTH", "Counter surface — wiped clean & clutter-free", "high");
  add("Counter & till", 50, "BOTH", "POS terminal / card reader — wiped (screen-safe)", "med");
  add("Counter & till", 50, "BOTH", "Pens, bags, receipt rolls — stocked & tidy", "med");
  add("Counter & till", 50, "BOTH", "Under-counter — clear of rubbish & clutter", "low");

  // General store condition
  add("General store condition", 60, "BOTH", "Walls & fixtures — spot-check marks / scuffs", "med");
  add("General store condition", 60, "BOTH", "Lighting — all bulbs working, fittings dust-free", "med", { note: "Report blown bulbs to the manager." });
  add("General store condition", 60, "BOTH", "Air freshener / scent — refreshed if needed", "low");
  add("General store condition", 60, "BOTH", "Final walk-through — scan the store from the entrance", "low", { note: "Look at it through a customer's eyes; fix anything that looks off." });

  // Close the store (closing)
  add("Close the store", 70, "CLOSING", "Cash count & reconcile against POS", "high");
  add("Close the store", 70, "CLOSING", "Close POS / end-of-day on StoreHub", "high");
  add("Close the store", 70, "CLOSING", "Take waste to the external bin", "med", { note: "Nothing left inside overnight." });
  add("Close the store", 70, "CLOSING", "Lock display cases & back door", "med", { pj: false });
  add("Close the store", 70, "CLOSING", "Turn off ambient music", "low", { kl: false });
  add("Close the store", 70, "CLOSING", "Lights & air-con off", "high");
  add("Close the store", 70, "CLOSING", "Lock up & arm the alarm", "high", { pj: false });
  add("Close the store", 70, "CLOSING", "Lock up the store", "high", { kl: false });

  return out;
}
