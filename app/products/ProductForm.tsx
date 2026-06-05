import { createProduct, updateProduct } from "./actions";

type ProductLike = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string;
  targetSpecies: string;
  lifeStage: string;
  packSize: number | null;
  packUnit: string | null;
  supplierType: string;
  costPrice: number | null;
  retailPrice: number | null;
  isConsumable: boolean;
};

export default function ProductForm({ product }: { product?: ProductLike }) {
  const isEdit = !!product;
  const action = isEdit ? updateProduct : createProduct;

  return (
    <form action={action} className="bg-white border border-slate-200 rounded-lg p-6 max-w-3xl space-y-4">
      {isEdit && <input type="hidden" name="id" value={product!.id} />}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            SKU <span className="text-red-500">*</span>
          </label>
          <input
            name="sku"
            required
            defaultValue={product?.sku ?? ""}
            placeholder="HW-FC-001"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            required
            defaultValue={product?.name ?? ""}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
          <input
            name="brand"
            defaultValue={product?.brand ?? ""}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <input
            name="category"
            list="category-options"
            defaultValue={product?.category ?? ""}
            placeholder="food, litter, treat, accessory, bed…"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <datalist id="category-options">
            <option value="food" />
            <option value="litter" />
            <option value="treat" />
            <option value="accessory" />
            <option value="bed" />
            <option value="grooming" />
            <option value="supplement" />
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Target species</label>
          <select
            name="targetSpecies"
            defaultValue={product?.targetSpecies ?? "ANY"}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="ANY">Any</option>
            <option value="DOG">Dog</option>
            <option value="CAT">Cat</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Life stage</label>
          <select
            name="lifeStage"
            defaultValue={product?.lifeStage ?? "ANY"}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="ANY">Any</option>
            <option value="PUPPY_KITTEN">Puppy / Kitten</option>
            <option value="ADULT">Adult</option>
            <option value="SENIOR">Senior</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Pack size</label>
          <input
            name="packSize"
            type="number"
            step="0.01"
            defaultValue={product?.packSize ?? ""}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Pack unit</label>
          <select
            name="packUnit"
            defaultValue={product?.packUnit ?? ""}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">—</option>
            <option value="G">g</option>
            <option value="KG">kg</option>
            <option value="ML">ml</option>
            <option value="L">L</option>
            <option value="COUNT">count</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Supplier type <span className="text-red-500">*</span>
          </label>
          <select
            name="supplierType"
            defaultValue={product?.supplierType ?? "TRADING"}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="TRADING">Trading</option>
            <option value="CONSIGNMENT">Consignment</option>
            <option value="INHOUSE">In-house</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cost price (RM)</label>
          <input
            name="costPrice"
            type="number"
            step="0.01"
            defaultValue={product?.costPrice ?? ""}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Retail price (RM)</label>
          <input
            name="retailPrice"
            type="number"
            step="0.01"
            defaultValue={product?.retailPrice ?? ""}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
        <input type="checkbox" name="isConsumable" defaultChecked={product?.isConsumable ?? false} />
        <span>
          <strong>Consumable</strong> — only consumables (food, litter) get refill predictions
        </span>
      </label>

      <div className="flex gap-2">
        <button className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700">
          {isEdit ? "Save changes" : "Create product"}
        </button>
      </div>
    </form>
  );
}
