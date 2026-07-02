// Small display formatting helpers (currency in MYR, dates).
//
// Timestamps are stored as UTC instants; Haiwan operates in Malaysia, so all
// dates are RENDERED in Asia/Kuala_Lumpur. Without this the server's own
// timezone leaks through — on Vercel (UTC) a 17:56 MYT sale would show as 09:56.
// Malaysia has no DST (fixed UTC+8), so this is stable year-round.

const TZ = "Asia/Kuala_Lumpur";

export function rm(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return "RM " + amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-MY", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** "YYYY-MM" for a UTC instant, bucketed by Malaysia calendar month. */
export function monthKeyMYT(d: Date): string {
  // en-CA renders YYYY-MM-DD; take the year-month, in MYT.
  return d.toLocaleDateString("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).slice(0, 7);
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-MY", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
