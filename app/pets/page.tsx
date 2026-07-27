import Link from "next/link";
import { prisma } from "@/lib/db";
import { rm } from "@/lib/format";
import { SPECIES_LABELS, LIFESTAGE_LABELS } from "@/lib/constants";
import { effectiveStage } from "@/lib/analytics";
import Pagination from "@/app/components/Pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

function ageLabel(dob: Date | null, approx: number | null): string {
  let months = approx;
  if (months == null && dob) {
    months = Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  }
  if (months == null) return "—";
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? `${years}y ${rem}m` : `${years}y`;
}

type SearchParams = Promise<{ q?: string; species?: string; stage?: string; page?: string }>;

export default async function PetsPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, species, stage, page: pageParam } = await searchParams;

  const where: Record<string, unknown> = {};
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term } },
      { breed: { contains: term } },
      { customer: { name: { contains: term } } },
    ];
  }
  if (species && species !== "ALL") where.species = species;
  if (stage && stage !== "ALL") where.lifeStage = stage;

  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [totalCount, pets] = await Promise.all([
    prisma.pet.count({ where }),
    prisma.pet.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        transactionLines: { select: { lineTotal: true } },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const withSpend = pets.map((p) => ({
    ...p,
    spend: p.transactionLines.reduce((s, l) => s + l.lineTotal, 0),
    derivedStage: effectiveStage(p),
  }));

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pets</h1>
        <span className="text-sm text-slate-500">{totalCount.toLocaleString()} pets</span>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        Open a pet to see its profile, health notes, refill timing and spend.
      </p>

      <form className="bg-white border border-slate-200 rounded-xl p-3 mb-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Search (pet name, breed, owner)
          </label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="e.g. Mochi or Shih Tzu…"
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Species</label>
          <select name="species" defaultValue={species ?? "ALL"} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="ALL">All</option>
            <option value="DOG">Dogs</option>
            <option value="CAT">Cats</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Life stage</label>
          <select name="stage" defaultValue={stage ?? "ALL"} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="ALL">All</option>
            <option value="PUPPY_KITTEN">Puppy / Kitten</option>
            <option value="ADULT">Adult</option>
            <option value="SENIOR">Senior</option>
          </select>
        </div>
        <button className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700">
          Apply
        </button>
        <Link href="/pets" className="text-sm text-slate-500 hover:text-slate-800 pb-1.5">
          Reset
        </Link>
      </form>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {withSpend.map((p) => (
          <Link
            key={p.id}
            href={`/pets/${p.id}`}
            className="group flex bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all"
          >
            {/* Picture — fills the whole left rectangle */}
            <div className="shrink-0 w-32 self-stretch relative bg-slate-100 border-r border-slate-100">
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photoUrl}
                  alt={p.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center text-3xl font-semibold text-slate-300"
                  aria-hidden
                >
                  {(p.name?.trim()?.[0] ?? "?").toUpperCase()}
                </div>
              )}
            </div>

            {/* Details — right */}
            <div className="flex-1 min-w-0 p-4 flex flex-col">
              <div className="font-semibold text-slate-900 truncate group-hover:text-slate-700">
                {p.name}
              </div>
              <div className="text-sm text-slate-500 truncate">
                {SPECIES_LABELS[p.species]}
                {p.breed && ` · ${p.breed}`}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {ageLabel(p.dateOfBirth, p.approxAgeMonths)}
                {p.lifeStage && ` · ${LIFESTAGE_LABELS[p.lifeStage]}`}
              </div>

              <div className="text-xs text-slate-400 mt-2">
                Parent <span className="text-slate-600">{p.customer.name ?? "Unnamed"}</span>
              </div>

              <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">Lifetime spend</span>
                <span className="text-sm font-medium text-slate-800">{rm(p.spend)}</span>
              </div>

              {p.allergies && (
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
                  Allergy · {p.allergies}
                </div>
              )}
            </div>
          </Link>
        ))}
        {pets.length === 0 && (
          <div className="col-span-full text-center text-slate-400 py-10 border border-dashed border-slate-200 rounded-xl">
            No pets match your filters.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <Pagination
            basePath="/pets"
            params={{ q, species, stage }}
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
          />
        </div>
      )}
    </div>
  );
}
