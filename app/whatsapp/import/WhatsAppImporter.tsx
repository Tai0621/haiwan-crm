"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { parseWhatsAppExport } from "@/lib/whatsapp/parse";
import { ingestPastedChat } from "../actions";
import type { IngestSummary } from "@/lib/whatsapp/types";

export default function WhatsAppImporter() {
  const [text, setText] = useState("");
  const [phone, setPhone] = useState("");
  const [usSenders, setUsSenders] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<IngestSummary | null>(null);

  // Live preview — parse client-side purely to populate the sender picker.
  const parsed = useMemo(() => (text.trim() ? parseWhatsAppExport(text) : null), [text]);

  function toggleUs(sender: string) {
    setUsSenders((prev) => {
      const next = new Set(prev);
      if (next.has(sender)) next.delete(sender);
      else next.add(sender);
      return next;
    });
  }

  function submit() {
    setResult(null);
    startTransition(async () => {
      const r = await ingestPastedChat(text, phone, Array.from(usSenders));
      setResult(r);
      if (r.inserted > 0) setText("");
    });
  }

  const canSubmit = !!text.trim() && !!phone.trim() && !pending;

  return (
    <div className="space-y-5">
      {/* How-to */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 space-y-1">
        <p className="font-medium">How to export a chat from WhatsApp</p>
        <ol className="list-decimal pl-5 space-y-0.5 text-blue-800">
          <li>Open the customer&apos;s chat → tap the contact name → <strong>Export chat</strong>.</li>
          <li>Choose <strong>Without media</strong>. Send the .txt to yourself, open it, copy all.</li>
          <li>Paste below, enter the customer&apos;s phone, and mark which sender is Haiwan.</li>
        </ol>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Pasted chat export</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="[01/06/2024, 14:32] Aishah: Hi, nak order 2 bag kibble..."
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
        />
        {parsed && (
          <p className="text-xs text-slate-500 mt-1">
            Parsed {parsed.entries.length} message{parsed.entries.length === 1 ? "" : "s"}
            {parsed.unparsed > 0 && ` · ${parsed.unparsed} line(s) ignored`}.
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Customer phone *</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="012-345 6789"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">
            Exports don&apos;t include numbers — enter the customer&apos;s. Normalized to 60xxxxxxxxx.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Which sender is Haiwan (us)?</label>
          {parsed && parsed.senders.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {parsed.senders.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleUs(s)}
                  className={`px-3 py-1.5 rounded-md text-sm border ${
                    usSenders.has(s)
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Paste a chat to detect senders.</p>
          )}
          <p className="text-xs text-slate-400 mt-1">
            Selected senders are stored as our replies (outbound); everyone else is the customer.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Importing…" : "Import messages"}
        </button>
        <Link href="/whatsapp" className="text-sm text-slate-500 hover:underline">
          Back to WhatsApp
        </Link>
      </div>

      {result && (
        <div className="text-sm space-y-2">
          <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2 text-green-800">
            Imported {result.inserted} · skipped {result.skippedDuplicate} duplicate(s) · matched{" "}
            {result.customersMatched} existing customer(s) · created {result.customersCreated} new.
          </div>
          {result.errors.length > 0 && (
            <ul className="text-xs text-red-600 list-disc pl-5 space-y-0.5">
              {result.errors.slice(0, 8).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
