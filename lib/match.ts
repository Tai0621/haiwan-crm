// =============================================================================
// Fuzzy-ish product name matching for the StoreHub importer.
//
// StoreHub exports a free-text product name, not our SKU. We match it to a
// known Product by NORMALISING both sides (lowercase, strip punctuation,
// collapse whitespace) and comparing. This is deliberately simple — the goal
// is to catch obvious matches and leave the rest as unmatched (productId=null,
// rawProductName preserved) for staff to resolve later.
// =============================================================================

/** Normalise a product name for comparison. */
export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // punctuation -> space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a lookup from normalised product name -> productId.
 * Also indexes by SKU (lowercased) so imports carrying a SKU match too.
 */
export function buildProductIndex(
  products: Array<{ id: string; name: string; sku: string }>,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const p of products) {
    index.set(normalizeProductName(p.name), p.id);
    index.set(p.sku.toLowerCase().trim(), p.id);
  }
  return index;
}

/**
 * Try to match a raw imported name to a productId.
 * 1. exact normalised-name hit
 * 2. exact SKU hit (if the raw value looks like a SKU)
 * 3. substring containment either direction (first hit wins)
 */
export function matchProduct(
  rawName: string,
  index: Map<string, string>,
): string | null {
  const norm = normalizeProductName(rawName);
  if (!norm) return null;

  // Exact normalised match
  if (index.has(norm)) return index.get(norm)!;

  // Raw value as SKU
  const skuKey = rawName.toLowerCase().trim();
  if (index.has(skuKey)) return index.get(skuKey)!;

  // Containment fallback
  for (const [key, id] of index) {
    if (key.length < 4) continue; // avoid matching on tiny SKU keys
    if (key.includes(norm) || norm.includes(key)) return id;
  }

  return null;
}
