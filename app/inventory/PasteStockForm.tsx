"use client";

import { useState, useTransition } from "react";
import { submitStockMessage } from "./actions";
import type { ParseResult } from "@/lib/stock-agent";

// Paste a WhatsApp stock message (restock / transfer / stock take) and let the
// agent parse it into a pending update below. Same pipeline the live WhatsApp
// webhook feeds once the Meta number is connected.
export default function PasteStockForm() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!text.trim() || pending) return;
    startTransition(async () => {
      const r = await submitStockMessage(text);
      setResult(r);
      if (r.ok) setText("");
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Stock message</h2>
      <p className="mb-2 text-xs text-slate-400">
        Paste (or later, WhatsApp) a restock / transfer / stock-take list — e.g.{" "}
        <span className="font-mono">&quot;Restock PJ: Ziwi lamb x12, RC kitten 2kg x6&quot;</span> or{" "}
        <span className="font-mono">&quot;Transfer 5 tofu litter KL to PJ&quot;</span>. It&apos;s parsed into a
        pending update for review before anything changes.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Restock KL: …"
        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={pending || !text.trim()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Parsing…" : "Parse message"}
        </button>
        {result?.ok && (
          <span className="text-sm text-emerald-600">
            Parsed {result.itemCount} item{result.itemCount === 1 ? "" : "s"}
            {result.unmatched ? ` (${result.unmatched} unmatched — fix below)` : ""} — review &amp; apply below.
          </span>
        )}
        {result && !result.ok && <span className="text-sm text-red-600">{result.error}</span>}
      </div>
    </div>
  );
}
