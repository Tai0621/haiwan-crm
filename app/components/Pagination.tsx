import Link from "next/link";

// Lightweight server-rendered pager. Preserves the current filters by taking the
// existing query params and overriding only `page`. Renders nothing when there
// is a single page.
export default function Pagination({
  basePath,
  params,
  page,
  totalPages,
  totalCount,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  totalCount: number;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== "" && k !== "page") sp.set(k, v);
    }
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 text-sm">
      <span className="text-slate-500">
        Page {page} of {totalPages} · {totalCount.toLocaleString()} total
      </span>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            href={href(prev)}
            className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            ← Prev
          </Link>
        ) : (
          <span className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-300 cursor-not-allowed">
            ← Prev
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={href(next)}
            className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Next →
          </Link>
        ) : (
          <span className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-300 cursor-not-allowed">
            Next →
          </span>
        )}
      </div>
    </div>
  );
}
