import { lifecycleSegments, marginMixAllCustomers, productAnalysis } from "@/lib/analytics";
import AnalysisView from "./AnalysisView";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const [lifecycle, margin, products] = await Promise.all([
    lifecycleSegments(),
    marginMixAllCustomers(),
    productAnalysis(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-1">Analysis</h1>
      <p className="text-sm text-slate-500 mb-4">
        Lenses on customers and products to guide outreach and the shift toward in-house margin.
      </p>
      <AnalysisView lifecycle={lifecycle} margin={margin} products={products} />
    </div>
  );
}
