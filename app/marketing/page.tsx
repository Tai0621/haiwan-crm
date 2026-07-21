export const dynamic = "force-dynamic";

// The Adset Strategy Explorer is a self-contained interactive tool shipped as a
// static file in /public. It has its own design language, so we mount it in an
// iframe rather than restyling it into the CRM's system.
export default function MarketingPage() {
  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[560px] flex-col gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Marketing</h1>
        <p className="text-sm text-slate-500">
          Campaign planning tools. The Adset Strategy Explorer builds a Meta ad-set brief for any
          variable combination and keeps team notes per combo.
        </p>
      </div>
      <iframe
        src="/tools/adset-explorer.html"
        title="Adset Strategy Explorer"
        className="w-full flex-1 rounded-lg border border-slate-200 bg-white"
      />
    </div>
  );
}
