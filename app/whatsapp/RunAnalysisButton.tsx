"use client";

import { useState, useTransition } from "react";
import { runAnalysis } from "./actions";
import type { AnalysisSummary } from "@/lib/whatsapp/analyze";

export default function RunAnalysisButton({ unanalyzed }: { unanalyzed: number }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AnalysisSummary | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      const r = await runAnalysis(); // whole unanalysed backlog
      setResult(r);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={pending || unanalyzed === 0}
          className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Analyzing…" : "Run end-of-day analysis"}
        </button>
        <span className="text-sm text-slate-500">
          {unanalyzed === 0
            ? "No new messages to analyze."
            : `${unanalyzed} unanalyzed message${unanalyzed === 1 ? "" : "s"} waiting.`}
        </span>
      </div>

      {result && !result.ok && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {result.reason ?? "Analysis failed."}
        </p>
      )}
      {result && result.ok && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          Analyzed {result.messagesAnalyzed} message{result.messagesAnalyzed === 1 ? "" : "s"} across{" "}
          {result.customersAnalyzed} customer{result.customersAnalyzed === 1 ? "" : "s"} — found{" "}
          {result.leadsCreated} lead{result.leadsCreated === 1 ? "" : "s"}.
          {result.errors.length > 0 && ` (${result.errors.length} error${result.errors.length === 1 ? "" : "s"})`}
        </p>
      )}
      {result && result.errors.length > 0 && (
        <ul className="text-xs text-red-600 list-disc pl-5 space-y-0.5">
          {result.errors.slice(0, 5).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
