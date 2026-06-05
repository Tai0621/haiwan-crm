"use client";

import { useState } from "react";
import Link from "next/link";
import { createPet, updatePet, deletePet } from "../actions";
import { SPECIES_LABELS, LIFESTAGE_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import PhotoUpload from "@/app/components/PhotoUpload";
import PetAvatar from "@/app/components/PetAvatar";

type Pet = {
  id: string;
  name: string;
  photoUrl: string | null;
  species: string;
  breed: string | null;
  sex: string | null;
  neutered: boolean;
  dateOfBirth: Date | string | null;
  adoptionDate: Date | string | null;
  approxAgeMonths: number | null;
  weightKg: number | null;
  lifeStage: string | null;
  colorMarkings: string | null;
  microchipId: string | null;
  vetName: string | null;
  dietaryNotes: string | null;
  allergies: string | null;
  notes: string | null;
};

function PetFields({ pet }: { pet?: Pet }) {
  const dobValue = pet?.dateOfBirth
    ? new Date(pet.dateOfBirth).toISOString().slice(0, 10)
    : "";
  const adoptionValue = pet?.adoptionDate
    ? new Date(pet.adoptionDate).toISOString().slice(0, 10)
    : "";
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="block text-xs font-medium text-slate-500 mb-1">Photo</label>
        <PhotoUpload name="photoUrl" defaultValue={pet?.photoUrl} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Name *</label>
        <input name="name" required defaultValue={pet?.name ?? ""} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Species</label>
        <select name="species" defaultValue={pet?.species ?? "DOG"} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm">
          <option value="DOG">Dog</option>
          <option value="CAT">Cat</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Breed</label>
        <input name="breed" defaultValue={pet?.breed ?? ""} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Sex</label>
        <select name="sex" defaultValue={pet?.sex ?? ""} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">— (unset)</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="UNKNOWN">Unknown</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Life stage</label>
        <select name="lifeStage" defaultValue={pet?.lifeStage ?? ""} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">— (unset)</option>
          <option value="PUPPY_KITTEN">Puppy / Kitten</option>
          <option value="ADULT">Adult</option>
          <option value="SENIOR">Senior</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600 pt-5">
        <input type="checkbox" name="neutered" defaultChecked={pet?.neutered ?? false} />
        Spayed / neutered
      </label>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Date of birth</label>
        <input type="date" name="dateOfBirth" defaultValue={dobValue} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Adoption date (&ldquo;gotcha day&rdquo;)</label>
        <input type="date" name="adoptionDate" defaultValue={adoptionValue} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Approx age (months) — if DOB unknown</label>
        <input type="number" name="approxAgeMonths" defaultValue={pet?.approxAgeMonths ?? ""} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Weight (kg)</label>
        <input type="number" step="0.1" name="weightKg" defaultValue={pet?.weightKg ?? ""} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Colour / markings</label>
        <input name="colorMarkings" defaultValue={pet?.colorMarkings ?? ""} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Microchip ID</label>
        <input name="microchipId" defaultValue={pet?.microchipId ?? ""} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Vet / clinic</label>
        <input name="vetName" defaultValue={pet?.vetName ?? ""} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Allergies</label>
        <input name="allergies" defaultValue={pet?.allergies ?? ""} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-slate-500 mb-1">Dietary notes</label>
        <textarea name="dietaryNotes" rows={2} defaultValue={pet?.dietaryNotes ?? ""} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-slate-500 mb-1">General notes (temperament, preferences…)</label>
        <textarea name="notes" rows={2} defaultValue={pet?.notes ?? ""} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
    </div>
  );
}

export default function PetManager({ customerId, pets }: { customerId: string; pets: Pet[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {pets.length === 0 && !adding && (
        <p className="text-sm text-slate-400">No pets recorded yet.</p>
      )}

      {pets.map((pet) =>
        editingId === pet.id ? (
          <form
            key={pet.id}
            action={async (fd) => {
              await updatePet(fd);
              setEditingId(null);
            }}
            className="border border-slate-300 rounded-lg p-4 bg-slate-50"
          >
            <input type="hidden" name="id" value={pet.id} />
            <input type="hidden" name="customerId" value={customerId} />
            <PetFields pet={pet} />
            <div className="flex gap-2 mt-3">
              <button className="bg-slate-900 text-white px-3 py-1.5 rounded-md text-sm">Save</button>
              <button type="button" onClick={() => setEditingId(null)} className="text-sm text-slate-500 hover:underline">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div key={pet.id} className="border border-slate-200 rounded-lg p-4 flex justify-between items-start gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <PetAvatar name={pet.name} photoUrl={pet.photoUrl} size="md" />
              <div className="min-w-0">
                <div className="font-medium text-slate-900">
                  <Link href={`/pets/${pet.id}`} className="hover:underline">
                    {pet.name}
                  </Link>
                  {pet.lifeStage && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {LIFESTAGE_LABELS[pet.lifeStage]}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500 mt-0.5">
                  {SPECIES_LABELS[pet.species]}
                  {pet.breed && ` · ${pet.breed}`}
                  {pet.weightKg != null && ` · ${pet.weightKg} kg`}
                  {pet.dateOfBirth
                    ? ` · DOB ${fmtDate(pet.dateOfBirth)}`
                    : pet.approxAgeMonths != null
                    ? ` · ~${pet.approxAgeMonths} mo`
                    : ""}
                </div>
                {(pet.dietaryNotes || pet.allergies) && (
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    {pet.allergies && <div><span className="font-medium text-amber-700">Allergies:</span> {pet.allergies}</div>}
                    {pet.dietaryNotes && <div><span className="font-medium">Diet:</span> {pet.dietaryNotes}</div>}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href={`/pets/${pet.id}`} className="text-xs text-slate-900 font-medium hover:underline">
                Profile →
              </Link>
              <button onClick={() => setEditingId(pet.id)} className="text-xs text-slate-600 hover:underline">
                Edit
              </button>
              <form
                action={async (fd) => {
                  await deletePet(fd);
                }}
              >
                <input type="hidden" name="id" value={pet.id} />
                <input type="hidden" name="customerId" value={customerId} />
                <button
                  className="text-xs text-red-600 hover:underline"
                  onClick={(e) => {
                    if (!confirm(`Delete ${pet.name}? Past purchases will keep their record but lose the pet link.`)) {
                      e.preventDefault();
                    }
                  }}
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        )
      )}

      {adding ? (
        <form
          action={async (fd) => {
            await createPet(fd);
            setAdding(false);
          }}
          className="border border-slate-300 rounded-lg p-4 bg-slate-50"
        >
          <input type="hidden" name="customerId" value={customerId} />
          <PetFields />
          <div className="flex gap-2 mt-3">
            <button className="bg-slate-900 text-white px-3 py-1.5 rounded-md text-sm">Add pet</button>
            <button type="button" onClick={() => setAdding(false)} className="text-sm text-slate-500 hover:underline">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-sm border border-dashed border-slate-300 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 w-full"
        >
          + Add pet
        </button>
      )}
    </div>
  );
}
