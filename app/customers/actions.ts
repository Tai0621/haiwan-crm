"use server";

import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ---------------------------------------------------------------------------
// Customer actions
// ---------------------------------------------------------------------------

// Parse the parallel pet-field arrays from the new-customer form into nested
// Pet create rows. A pet is only created if it has a name. Arrays are aligned
// by index (the form always submits every field per pet row).
function petsFromForm(formData: FormData) {
  const names = formData.getAll("petName").map(String);
  const photos = formData.getAll("petPhoto").map(String);
  const species = formData.getAll("petSpecies").map(String);
  const breeds = formData.getAll("petBreed").map(String);
  const sexes = formData.getAll("petSex").map(String);
  const neutered = formData.getAll("petNeutered").map(String);
  const lifeStages = formData.getAll("petLifeStage").map(String);
  const dobs = formData.getAll("petDob").map(String);
  const weights = formData.getAll("petWeight").map(String);
  const allergies = formData.getAll("petAllergies").map(String);
  const dietary = formData.getAll("petDietaryNotes").map(String);

  const pets = [];
  for (let i = 0; i < names.length; i++) {
    const name = (names[i] ?? "").trim();
    if (!name) continue; // skip empty rows
    pets.push({
      name,
      photoUrl: photos[i]?.trim() || null,
      species: (species[i] as "DOG" | "CAT" | "OTHER") || "DOG",
      breed: breeds[i]?.trim() || null,
      sex: (sexes[i] as "MALE" | "FEMALE" | "UNKNOWN") || null,
      neutered: neutered[i] === "true",
      lifeStage: (lifeStages[i] as "PUPPY_KITTEN" | "ADULT" | "SENIOR") || null,
      dateOfBirth: dobs[i] ? new Date(dobs[i]) : null,
      weightKg: weights[i] ? parseFloat(weights[i]) : null,
      allergies: allergies[i]?.trim() || null,
      dietaryNotes: dietary[i]?.trim() || null,
    });
  }
  return pets;
}

export async function createCustomer(formData: FormData) {
  const rawPhone = String(formData.get("phone") ?? "");
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error("A valid phone number is required.");

  const consent = formData.get("marketingConsent") === "on";
  const pets = petsFromForm(formData);

  const customer = await prisma.customer.create({
    data: {
      phone,
      name: (formData.get("name") as string) || null,
      email: (formData.get("email") as string) || null,
      preferredStore: (formData.get("preferredStore") as "KL" | "PJ" | "NONE") || "NONE",
      source: (formData.get("source") as "STOREHUB" | "WHATSAPP" | "WALKIN" | "OTHER") || "WALKIN",
      marketingConsent: consent,
      consentDate: consent ? new Date() : null,
      notes: (formData.get("notes") as string) || null,
      needsDetails: false,
      pets: pets.length ? { create: pets } : undefined,
    },
  });

  revalidatePath("/customers");
  revalidatePath("/pets");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(formData: FormData) {
  const id = String(formData.get("id"));
  const rawPhone = String(formData.get("phone") ?? "");
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error("A valid phone number is required.");

  const consent = formData.get("marketingConsent") === "on";

  // Preserve original consentDate if already consented; set now on new opt-in.
  const existing = await prisma.customer.findUnique({
    where: { id },
    select: { consentDate: true },
  });

  await prisma.customer.update({
    where: { id },
    data: {
      phone,
      name: (formData.get("name") as string) || null,
      email: (formData.get("email") as string) || null,
      preferredStore: (formData.get("preferredStore") as "KL" | "PJ" | "NONE") || "NONE",
      source: (formData.get("source") as "STOREHUB" | "WHATSAPP" | "WALKIN" | "OTHER") || "OTHER",
      marketingConsent: consent,
      consentDate: consent ? existing?.consentDate ?? new Date() : null,
      notes: (formData.get("notes") as string) || null,
      // Editing a customer clears the "needs details" stub flag
      needsDetails: false,
    },
  });

  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  redirect(`/customers/${id}`);
}

export async function deleteCustomer(formData: FormData) {
  const id = String(formData.get("id"));
  // Pets cascade-delete; transactions are kept but unlinked (customerId -> null)
  await prisma.transaction.updateMany({
    where: { customerId: id },
    data: { customerId: null },
  });
  await prisma.subscription.deleteMany({ where: { customerId: id } });
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/customers");
  redirect("/customers");
}

// ---------------------------------------------------------------------------
// Pet actions (managed from the customer detail page and the pet profile page)
// ---------------------------------------------------------------------------

// Shared extraction of pet fields from a form (used by create + update).
function petDataFromForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Pet name is required.");

  const str = (k: string) => (formData.get(k) as string)?.trim() || null;
  const dob = formData.get("dateOfBirth") as string;
  const adoption = formData.get("adoptionDate") as string;
  const ageMonths = formData.get("approxAgeMonths") as string;
  const weight = formData.get("weightKg") as string;

  return {
    name,
    photoUrl: (formData.get("photoUrl") as string) || null,
    species: (formData.get("species") as "DOG" | "CAT" | "OTHER") || "DOG",
    breed: str("breed"),
    sex: (formData.get("sex") as "MALE" | "FEMALE" | "UNKNOWN") || null,
    neutered: formData.get("neutered") === "on",
    dateOfBirth: dob ? new Date(dob) : null,
    adoptionDate: adoption ? new Date(adoption) : null,
    approxAgeMonths: ageMonths ? parseInt(ageMonths, 10) : null,
    weightKg: weight ? parseFloat(weight) : null,
    lifeStage: (formData.get("lifeStage") as "PUPPY_KITTEN" | "ADULT" | "SENIOR") || null,
    colorMarkings: str("colorMarkings"),
    microchipId: str("microchipId"),
    vetName: str("vetName"),
    dietaryNotes: str("dietaryNotes"),
    allergies: str("allergies"),
    notes: str("notes"),
  };
}

export async function createPet(formData: FormData) {
  const customerId = String(formData.get("customerId"));
  await prisma.pet.create({ data: { customerId, ...petDataFromForm(formData) } });
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/pets");
}

export async function updatePet(formData: FormData) {
  const id = String(formData.get("id"));
  const customerId = String(formData.get("customerId"));
  await prisma.pet.update({ where: { id }, data: petDataFromForm(formData) });
  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/pets/${id}`);
  revalidatePath("/pets");
}

export async function deletePet(formData: FormData) {
  const id = String(formData.get("id"));
  const customerId = String(formData.get("customerId"));
  await prisma.pet.delete({ where: { id } });
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/pets");
}
