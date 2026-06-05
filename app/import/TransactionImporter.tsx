"use client";

import { useState } from "react";
import Papa from "papaparse";
import { importTransactions, type TxnMapping, type TxnImportSummary } from "./actions";

const FIELDS: Array<{ key: keyof TxnMapping; label: string; required?: boolean; guesses: string[] }> = [
  { key: "phone", label: "Phone", required: true, guesses: ["phone", "mobile", "contact", "tel", "hp"] },
  { key: "transactionDate", label: "Transaction date", required: true, guesses: ["date", "datetime", "time", "transactiondate", "createdat"] },
  { key: "store", label: "Store", guesses: ["store", "branch", "outlet", "location"] },
  { key: "storehubRef", label: "Receipt / ref", guesses: ["ref", "receipt", "receiptno", "transactionid", "orderid", "invoice"] },
  { key: "productName", label: "Product name", required: true, guesses: ["product", "productname", "item", "itemname", "description"] },
  { key: "quantity", label: "Quantity", guesses: ["qty", "quantity", "units"] },
  { key: "unitPrice", label: "Unit price", guesses: ["unitprice", "price", "unit", "rate"] },
  { key: "lineTotal", label: "Line total", guesses: ["linetotal", "subtotal", "amount", "total"] },
  { key: "transactionTotal", label: "Transaction total", guesses: ["transactiontotal", "grandtotal", "ordertotal", "nettotal"] },
];

function guessMapping(headers: string[]): TxnMapping {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normHeaders = headers.map((h) => ({ raw: h, n: norm(h) }));
  const out = {} as TxnMapping;
  for (const f of FIELDS) {
    const hit =
      normHeaders.find((h) => f.guesses.some((g) => h.n === g)) ??
      normHeaders.find((h) => f.guesses.some((g) => h.n.includes(g)));
    out[f.key] = hit?.raw ?? "";
  }
  return out;
}

export default function TransactionImporter() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<TxnMapping | null>(null);
  const [groupBy, setGroupBy] = useState<"ref" | "phone-date">("ref");
  const [summary, setSummary] = useState<TxnImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");

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
        setHeaders(hdrs);
        setRows(res.data);
        const m = guessMapping(hdrs);
        setMapping(m);
        // Default grouping: by ref if a ref column was detected, else phone+date.
        setGroupBy(m.storehubRef ? "ref" : "phone-date");
      },
    });
  }

  async function doImport() {
    if (!mapping) return;
    setBusy(true);
    try {
      const result = await importTransactions(rows, mapping, groupBy);
      setSummary(result);
    } finally {
      setBusy(false);
    }
  }

  const canImport = mapping && mapping.phone && mapping.transactionDate && mapping.productName;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">StoreHub transaction CSV</label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="block text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-slate-900 file:text-white file:text-sm file:font-medium hover:file:bg-slate-700"
        />
        <p className="text-xs text-slate-400 mt-1">
          One row per line item. Rows are grouped into transactions, phones normalised &amp;
          matched (stubs created if new), products matched by name. Re-importing the same receipt
          ref is skipped.
        </p>
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

            <div className="mt-4 border-t border-slate-200 pt-3">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Group line-rows into transactions by
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as "ref" | "phone-date")}
                className="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white"
              >
                <option value="ref">Receipt / ref (recommended when a ref column exists)</option>
                <option value="phone-date">Phone + date (same person, same day)</option>
              </select>
            </div>
          </div>

          <button
            onClick={doImport}
            disabled={busy || !canImport}
            className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? "Importing…" : `Import ${rows.length} rows`}
          </button>
          {!canImport && (
            <p className="text-xs text-red-500">Map Phone, Transaction date and Product name to enable import.</p>
          )}
        </>
      )}

      {summary && (
        <div className="bg-white border border-green-200 rounded-lg p-4">
          <p className="font-medium text-slate-800 mb-3">Import complete</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat n={summary.transactionsCreated} label="transactions created" color="text-green-600" />
            <Stat n={summary.transactionsSkippedDuplicate} label="skipped (dup ref)" color="text-slate-400" />
            <Stat n={summary.customersMatched} label="customers matched" color="text-blue-600" />
            <Stat n={summary.stubsCreated} label="stub customers created" color="text-amber-600" />
            <Stat n={summary.linesMatched} label="lines matched to product" color="text-green-600" />
            <Stat n={summary.linesUnmatched} label="lines unmatched" color="text-amber-600" />
            <Stat n={summary.unmatchedPhoneRows} label="rows with no phone" color="text-slate-400" />
          </div>
          {summary.errors.length > 0 && (
            <details className="mt-3 text-xs text-amber-700">
              <summary className="cursor-pointer">{summary.errors.length} error(s)</summary>
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

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div>
      <div className={`text-2xl font-bold ${color}`}>{n}</div>
      <div className="text-slate-500">{label}</div>
    </div>
  );
}
