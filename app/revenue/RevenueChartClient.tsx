"use client";

import dynamic from "next/dynamic";

// Load recharts purely on the client. recharts is a large dependency and, under
// Turbopack dev, its server-streamed chunk can fail to resolve (ChunkLoadError).
// Deferring to a client-only dynamic import with a loading fallback avoids that
// and degrades gracefully.
const RevenueChart = dynamic(() => import("./RevenueChart"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] flex items-center justify-center text-sm text-slate-400">
      Loading chart…
    </div>
  ),
});

export default RevenueChart;
