"use client";

import { useState } from "react";
import { createCustomer, updateCustomer } from "./actions";
import PhotoUpload from "@/app/components/PhotoUpload";

type CustomerLike = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  preferredStore: string;
  source: string;
  marketingConsent: boolean;
  notes: string | null;
};

export default function CustomerForm({ customer }: { customer?: CustomerLike }) {
  const isEdit = !!customer;
  const action = isEdit ? updateCustomer : createCustomer;

  // Dynamic pet rows — only when creating a new customer. (On edit, pets are
  // managed on the customer detail page.) Each row is an opaque key.
  const [petKeys, setPetKeys] = useState<number[]>([]);
  const addPet = () => setPetKeys((k) => [...k, Date.now()]);
  const removePet = (key: number) => setPetKeys((k) => k.filter((x) => x !== key));

  return (
    <form action={action} className="bg-white border border-slate-200 rounded-lg p-6 max-w-2xl space-y-4">
      {isEdit && <input type="hidden" name="id" value={customer!.id} />}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Phone <span className="text-red-500">*</span>
        </label>
        <input
          name="phone"
          required
          defaultValue={customer?.phone ?? ""}
          placeholder="012-345 6789"
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
        <p className="text-xs text-slate-400 mt-1">
          Stored canonically as 60XXXXXXXXX — the identity key.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
          <input
            name="name"
            defaultValue={customer?.name ?? ""}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            name="email"
            type="email"
            defaultValue={customer?.email ?? ""}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Preferred store</label>
          <select
            name="preferredStore"
            defaultValue={customer?.preferredStore ?? "NONE"}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="NONE">No preference</option>
            <option value="KL">Kuala Lumpur</option>
            <option value="PJ">Petaling Jaya</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
          <select
            name="source"
            defaultValue={customer?.source ?? "WALKIN"}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="WALKIN">Walk-in</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="STOREHUB">StoreHub</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="marketingConsent"
          defaultChecked={customer?.marketingConsent ?? false}
        />
        Marketing consent (PDPA opt-in) — sets consent date to today
      </label>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={customer?.notes ?? ""}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      {/* ---- Pets layer (create only) ---- */}
      {!isEdit && (
        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-slate-800">
              Pets {petKeys.length > 0 && <span className="text-slate-400 font-normal">({petKeys.length})</span>}
            </h2>
            <button
              type="button"
              onClick={addPet}
              className="text-sm text-slate-900 font-medium hover:underline"
            >
              + Add pet
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Optionally record this customer&rsquo;s pets now — you can always add more later.
          </p>

          {petKeys.length === 0 && (
            <p className="text-xs text-slate-400 italic">No pets added yet.</p>
          )}

          <div className="space-y-3">
            {petKeys.map((key, i) => (
              <PetEntry key={key} index={i} onRemove={() => removePet(key)} />
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700">
          {isEdit ? "Save changes" : "Create customer"}
        </button>
      </div>
    </form>
  );
}

// One pet's inputs. Field names are repeated across rows; the server action
// reads them with formData.getAll(...) and zips them by index. Every field
// always submits a value (selects/text) so the parallel arrays stay aligned.
function PetEntry({ index, onRemove }: { index: number; onRemove: () => void }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500">Pet {index + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
          Remove
        </button>
      </div>
      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-500 mb-1">Photo</label>
        <PhotoUpload name="petPhoto" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Name <span className="text-red-400">*</span>
          </label>
          <input name="petName" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Species</label>
          <select name="petSpecies" defaultValue="DOG" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white">
            <option value="DOG">Dog</option>
            <option value="CAT">Cat</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Breed</label>
          <input name="petBreed" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Sex</label>
          <select name="petSex" defaultValue="" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white">
            <option value="">—</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Neutered</label>
          <select name="petNeutered" defaultValue="false" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white">
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Life stage</label>
          <select name="petLifeStage" defaultValue="" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white">
            <option value="">—</option>
            <option value="PUPPY_KITTEN">Puppy / Kitten</option>
            <option value="ADULT">Adult</option>
            <option value="SENIOR">Senior</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Date of birth</label>
          <input name="petDob" type="date" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Weight (kg)</label>
          <input name="petWeight" type="number" step="0.1" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Allergies</label>
          <input name="petAllergies" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div className="col-span-2 md:col-span-3">
          <label className="block text-xs font-medium text-slate-500 mb-1">Dietary notes</label>
          <input name="petDietaryNotes" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
      </div>
    </div>
  );
}
