"use client";

import { useState } from "react";
import ProductImporter from "./ProductImporter";
import TransactionImporter from "./TransactionImporter";

export default function ImportTabs() {
  const [tab, setTab] = useState<"transactions" | "products">("transactions");

  return (
    <div>
      <div className="flex gap-2 mb-4 border-b border-slate-200">
        <button
          onClick={() => setTab("transactions")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "transactions"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          StoreHub transactions
        </button>
        <button
          onClick={() => setTab("products")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "products"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Product catalog
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        {tab === "transactions" ? <TransactionImporter /> : <ProductImporter />}
      </div>
    </div>
  );
}
