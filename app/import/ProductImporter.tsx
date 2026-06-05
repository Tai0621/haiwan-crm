"use client";

import { useState } from "react";
import Papa from "papaparse";
import { importProducts, type ProductMapping, type ProductImportSummary } from "./actions";

// Product fields to map, with friendly labels and header-name guesses.
const FIELDS: Array<{ key: keyof ProductMapping; label: string; required?: boolean; guesses: string[] }> = [
  { key: "sku", label: "SKU", required: true, guesses: ["sku", "code", "itemcode", "barcode"] },
  { key: "name", label: "Name", required: true, guesses: ["name", "product", "productname", "item", "description"] },
  { key: "brand", label: "Brand", guesses: ["brand", "make"] },
  { key: "category", label: "Category", guesses: ["category", "type", "group"] },
  { key: "packSize", label: "Pack size", guesses: ["packsize", "size", "weight"] },
  { key: "packUnit", label: "Pack unit", guesses: ["packunit", "unit", "uom"] },
  { key: "supplierType", label: "Supplier type", guesses: ["suppliertype", "supplier", "source", "margin"] },
  { key: "costPrice", label: "Cost price", guesses: ["cost", "costprice", "buyprice"] },
  { key: "retailPrice", label: "Retail price", guesses: ["retail", "retailprice", "price", "sellprice"] },
  { key: "isConsumable", label: "Is consumable", guesses: ["consumable", "isconsumable"] },
  { key: "targetSpecies", label: "Target species", guesses: ["species", "targetspecies", "animal"] },
  { key: "lifeStage", label: "Life stage", guesses: ["lifestage", "stage", "age"] },
  { key: "stockKL", label: "Stock — KL", guesses: ["klquantity", "kl_quantity"] },
  { key: "stockPJ", label: "Stock — PJ", guesses: ["pjquantity", "pj_quantity"] },
];

function guessMapping(headers: string[]): ProductMapping {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normHeaders = headers.map((h) => ({ raw: h, n: norm(h) }));
  const out = {} as ProductMapping;
  for (const f of FIELDS) {
    const hit = normHeaders.find((h) => f.guesses.some((g) => h.n === g || h.n.includes(g)));
    out[f.key] = hit?.raw ?? "";
  }
  // StoreHub: the "SKU" column is blank — the real unique id is "Product Id".
  if (headers.includes("Product Id")) out.sku = "Product Id";
  if (headers.includes("Tax-Inclusive Price")) out.retailPrice = "Tax-Inclusive Price";
  const klCol = headers.find((h) => /KL_Quantity$/.test(h));
  const pjCol = headers.find((h) => /PJ_Quantity$/.test(h));
  if (klCol) out.stockKL = klCol;
  if (pjCol) out.stockPJ = pjCol;
  return out;
}

// A StoreHub product export has these signature columns.
function isStoreHub(headers: string[]): boolean {
  return headers.includes("Product Id") && headers.includes("Parent Product SKU");
}

// StoreHub files carry a field-description row (row 0) and "umbrella" parent
// rows for variant groups. Drop both so only real, sellable SKUs are imported.
function cleanStoreHubRows(rows: Record<string, string>[]): Record<string, string>[] {
  const body = rows.slice(1); // drop the description row
  const referenced = new Set(
    body.map((r) => (r["Parent Product SKU"] || "").trim()).filter(Boolean),
  );
  return body.filter((r) => {
    const pid = (r["Product Id"] || "").trim();
    const parent = (r["Parent Product SKU"] || "").trim();
    if (!pid) return false;
    // umbrella parent (no parent of its own, but referenced by variants) → skip
    if (!parent && referenced.has(pid)) return false;
    return true;
  });
}

export default function ProductImporter() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ProductMapping | null>(null);
  const [summary, setSummary] = useState<ProductImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [storeHub, setStoreHub] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSummary(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hdrs = res.meta.fields ?? [];
        const sh = isStoreHub(hdrs);
        setStoreHub(sh);
        setHeaders(hdrs);
        setRows(sh ? cleanStoreHubRows(res.data) : res.data);
        setMapping(guessMapping(hdrs));
      },
    });
  }

  async function doImport() {
    if (!mapping) return;
    setBusy(true);
    try {
      const result = await importProducts(rows, mapping);
      setSummary(result);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Product catalog CSV</label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="block text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-slate-900 file:text-white file:text-sm file:font-medium hover:file:bg-slate-700"
        />
        <p className="text-xs text-slate-400 mt-1">Upserts by SKU — existing products are updated.</p>
        {storeHub && (
          <p className="text-xs text-green-700 mt-1 font-medium">
            <span className="inline-block bg-green-100 rounded px-1.5 py-0.5 mr-1.5 not-italic">StoreHub detected</span>
            using <span className="font-mono">Product Id</span> as SKU, dropped the description row and
            variant umbrella rows. Consumables auto-detected from category.
          </p>
        )}
      </div>

      {headers.length > 0 && mapping && (
        <>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-sm font-medium text-slate-700 mb-3">
              Map columns — {rows.length} rows detected in <span className="font-mono">{fileName}</span>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={mapping[f.key]}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="">— skip —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={doImport}
            disabled={busy || !mapping.sku || !mapping.name}
            className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? "Importing…" : `Import ${rows.length} products`}
          </button>
          {(!mapping.sku || !mapping.name) && (
            <p className="text-xs text-red-500">Map both SKU and Name to enable import.</p>
          )}
        </>
      )}

      {summary && (
        <div className="bg-white border border-green-200 rounded-lg p-4">
          <p className="font-medium text-slate-800 mb-2">Import complete</p>
          <ul className="text-sm text-slate-600 grid grid-cols-3 gap-2">
            <li><span className="text-2xl font-bold text-green-600">{summary.created}</span><br />created</li>
            <li><span className="text-2xl font-bold text-blue-600">{summary.updated}</span><br />updated</li>
            <li><span className="text-2xl font-bold text-slate-400">{summary.skipped}</span><br />skipped</li>
          </ul>
          {summary.errors.length > 0 && (
            <details className="mt-3 text-xs text-amber-700">
              <summary className="cursor-pointer">{summary.errors.length} warning(s)</summary>
              <ul className="mt-1 list-disc list-inside">
                {summary.errors.slice(0, 50).map((er, i) => (
                  <li key={i}>{er}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
