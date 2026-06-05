import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ProductForm from "../../ProductForm";
import { deleteProduct } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { _count: { select: { lines: true } } },
  });
  if (!product) notFound();

  return (
    <div>
      <Link href="/products" className="text-sm text-slate-500 hover:underline">
        ← Back to products
      </Link>
      <div className="flex items-center justify-between mt-2 mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Edit product</h1>
        <form action={deleteProduct}>
          <input type="hidden" name="id" value={id} />
          <button className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-100 border border-red-200">
            Delete product
          </button>
        </form>
      </div>
      {product._count.lines > 0 && (
        <p className="text-xs text-amber-600 mb-3">
          This product appears on {product._count.lines} transaction line(s). Deleting it keeps those
          lines but unlinks them (they&apos;ll show as unmatched).
        </p>
      )}
      <ProductForm product={product} />
    </div>
  );
}
