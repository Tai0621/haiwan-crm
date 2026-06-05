import Link from "next/link";
import ProductForm from "../ProductForm";

export default function NewProductPage() {
  return (
    <div>
      <Link href="/products" className="text-sm text-slate-500 hover:underline">
        ← Back to products
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mt-2 mb-4">New product</h1>
      <ProductForm />
    </div>
  );
}
