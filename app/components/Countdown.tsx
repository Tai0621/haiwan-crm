"use client";

import { useEffect, useState } from "react";

// Live "23h 41m left" / "Expired" countdown for time-bound inbox rows (24h
// holds, inquiry first-reply deadlines). Ticks every 30s — fine at hour scale.
export default function Countdown({ expiresAt }: { expiresAt: string | Date }) {
  const target = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const ms = target.getTime() - now;
  if (ms <= 0) return <span className="font-medium text-red-600">Expired</span>;

  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const label = h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  const urgent = ms < 2 * 3_600_000;

  return <span className={urgent ? "font-medium text-orange-600" : "text-slate-500"}>{label}</span>;
}
