"use client";

import { useEffect, useMemo, useState } from "react";
import { createTransaction } from "./actions";
import { rm } from "@/lib/format";

export type ProductOpt = {
  id: string;
  name: string;
  sku: string;
  retailPrice: number | null;
};
export type CustomerOpt = { id: string; name: string | null; phone: string };

type LineRow = {
  key: number;
  name: string; // rawProductName (matched product name or free text)
  productId: string; // "" when unmatched
  qty: string;
  unitPrice: string;
};

const newRow = (): LineRow => ({
  key: Date.now() + Math.random(),
  name: "",
  productId: "",
  qty: "1",
  unitPrice: "",
});

export default function AddTransactionForm({
  products,
  customers,
  fixedCustomer,
  returnTo,
}: {
  products: ProductOpt[];
  customers?: CustomerOpt[];
  fixedCustomer?: CustomerOpt;
  returnTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LineRow[]>([newRow()]);
  const [dateVal, setDateVal] = useState("");

  // Prefill the date with "now" on the client only (avoids hydration mismatch).
  useEffect(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    setDateVal(
      `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`,
    );
  }, []);

  // "Name (SKU)" -> product, for resolving a type-ahead pick to an id + price.
  const byLabel = useMemo(() => {
    const m = new Map<string, ProductOpt>();
    for (const p of products) m.set(`${p.name} (${p.sku})`, p);
    return m;
  }, [products]);

  const setRow = (key: number, patch: Partial<LineRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const onProductChange = (key: number, value: string) => {
    const hit = byLabel.get(value);
    if (hit) {
      setRow(key, {
        name: hit.name,
        productId: hit.id,
        unitPrice: hit.retailPrice != null ? String(hit.retailPrice) : "",
      });
    } else {
      // free text — keep as an unmatched line (productId cleared)
      setRow(key, { name: value, productId: "" });
    }
  };

  const grandTotal = rows.reduce(
    (s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.unitPrice) || 0),
    0,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700"
      >
        + Add transaction
      </button>
    );
  }

  return (
    <form
      action={createTransaction}
      className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-4"
    >
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      {/* Customer */}
      {fixedCustomer ? (
        <input type="hidden" name="customerId" value={fixedCustomer.id} />
      ) : (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Customer <span className="text-red-500">*</span>
          </label>
          <select
            name="customerId"
            required
            defaultValue=""
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="" disabled>
              Choose a customer…
            </option>
            {(customers ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ? `${c.name} — ${c.phone}` : c.phone}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Store</label>
          <select
            name="store"
            defaultValue="KL"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="KL">Kuala Lumpur</option>
            <option value="PJ">Petaling Jaya</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date &amp; time</label>
          <input
            type="datetime-local"
            name="transactionDate"
            value={dateVal}
            onChange={(e) => setDateVal(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Shared product list for all line type-aheads */}
      <datalist id="product-options">
        {products.map((p) => (
          <option key={p.id} value={`${p.name} (${p.sku})`} />
        ))}
      </datalist>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-slate-700">Items</label>
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, newRow()])}
            className="text-sm text-slate-900 font-medium hover:underline"
          >
            + Add item
          </button>
        </div>
        <div className="space-y-2">
          {rows.map((r) => {
            const lineTotal =
              (parseFloat(r.qty) || 0) * (parseFloat(r.unitPrice) || 0);
            return (
              <div key={r.key} className="flex gap-2 items-start">
                <div className="flex-1">
                  <input
                    list="product-options"
                    name="lineProductName"
                    value={r.name}
                    onChange={(e) => onProductChange(r.key, e.target.value)}
                    placeholder="Product (type to search) or free text"
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  />
                  <input type="hidden" name="lineProductId" value={r.productId} />
                  {r.name && !r.productId && (
                    <span className="text-[11px] text-amber-600">
                      Not in catalog — will be saved as unmatched
                    </span>
                  )}
                </div>
                <input
                  name="lineQty"
                  type="number"
                  step="any"
                  min="0"
                  value={r.qty}
                  onChange={(e) => setRow(r.key, { qty: e.target.value })}
                  placeholder="Qty"
                  className="w-16 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
                <input
                  name="lineUnitPrice"
                  type="number"
                  step="any"
                  min="0"
                  value={r.unitPrice}
                  onChange={(e) => setRow(r.key, { unitPrice: e.target.value })}
                  placeholder="Unit RM"
                  className="w-24 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
                <div className="w-24 text-right text-sm text-slate-600 py-1.5 tabular-nums">
                  {rm(lineTotal)}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))
                  }
                  className="text-xs text-red-600 hover:underline py-2"
                  aria-label="Remove item"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 pt-3">
        <span className="text-sm font-medium text-slate-700">Total</span>
        <span className="text-base font-semibold text-slate-900 tabular-nums">
          {rm(grandTotal)}
        </span>
      </div>

      <div className="flex gap-2">
        <button className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700">
          Save transaction
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
