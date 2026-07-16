"use client";

import dynamic from "next/dynamic";

// recharts is large and its server-streamed chunk can fail under Turbopack dev
// (ChunkLoadError); load it client-only, like the revenue chart.
const BreakevenCharts = dynamic(() => import("./BreakevenCharts"), {
  ssr: false,
  loading: () => (
    <div className="mt-5 flex h-[200px] items-center justify-center border-t border-slate-100 pt-4 text-sm text-slate-400">
      Loading charts…
    </div>
  ),
});

export default BreakevenCharts;
