// Shown instantly during any route navigation that needs to load (Next.js
// wraps the routed page in a Suspense boundary with this as the fallback). The
// persistent nav sidebar stays; only the content area swaps to this spinner.
export default function Loading() {
  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm font-medium">Loading…</p>
      </div>
    </div>
  );
}
