// =============================================================================
// Haiwan CRM — Seed Script
// Generates realistic sample data so every screen is populated on first run.
// Run with:  npx prisma db seed
// =============================================================================

import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../app/generated/prisma/client";
import path from "path";
import "dotenv/config";

const dbUrl = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.startsWith("file:")
    ? `file:${path.resolve(__dirname, "..", process.env.DATABASE_URL.replace(/^file:/, ""))}`
    : process.env.DATABASE_URL
  : `file:${path.resolve(__dirname, "../../data/haiwan.db")}`;

const adapter = new PrismaLibSql({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log("Seeding Haiwan CRM database…");

  // -------------------------------------------------------------------------
  // Products — 25 items across all three supplierTypes, food + accessories
  // -------------------------------------------------------------------------
  const products = await Promise.all([
    // --- INHOUSE (Haiwan own brand) ---
    prisma.product.upsert({
      where: { sku: "HW-FC-001" },
      update: {},
      create: {
        sku: "HW-FC-001", name: "Haiwan Raw Chicken Formula (Dog)", brand: "Haiwan",
        category: "food", targetSpecies: "DOG", lifeStage: "ADULT",
        packSize: 1.5, packUnit: "KG", supplierType: "INHOUSE",
        costPrice: 18, retailPrice: 42, isConsumable: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HW-FC-002" },
      update: {},
      create: {
        sku: "HW-FC-002", name: "Haiwan Raw Salmon Formula (Cat)", brand: "Haiwan",
        category: "food", targetSpecies: "CAT", lifeStage: "ADULT",
        packSize: 1, packUnit: "KG", supplierType: "INHOUSE",
        costPrice: 20, retailPrice: 48, isConsumable: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HW-FC-003" },
      update: {},
      create: {
        sku: "HW-FC-003", name: "Haiwan Puppy Starter Mix", brand: "Haiwan",
        category: "food", targetSpecies: "DOG", lifeStage: "PUPPY_KITTEN",
        packSize: 1, packUnit: "KG", supplierType: "INHOUSE",
        costPrice: 16, retailPrice: 38, isConsumable: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HW-TR-001" },
      update: {},
      create: {
        sku: "HW-TR-001", name: "Haiwan Freeze-Dried Chicken Treats", brand: "Haiwan",
        category: "treat", targetSpecies: "ANY", lifeStage: "ANY",
        packSize: 100, packUnit: "G", supplierType: "INHOUSE",
        costPrice: 8, retailPrice: 22, isConsumable: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HW-LT-001" },
      update: {},
      create: {
        sku: "HW-LT-001", name: "Haiwan Tofu Cat Litter (Unscented)", brand: "Haiwan",
        category: "litter", targetSpecies: "CAT", lifeStage: "ANY",
        packSize: 7, packUnit: "KG", supplierType: "INHOUSE",
        costPrice: 12, retailPrice: 28, isConsumable: true,
      },
    }),
    // --- CONSIGNMENT ---
    prisma.product.upsert({
      where: { sku: "ZW-DRY-001" },
      update: {},
      create: {
        sku: "ZW-DRY-001", name: "Ziwi Peak Air-Dried Lamb (Dog) 1kg", brand: "Ziwi Peak",
        category: "food", targetSpecies: "DOG", lifeStage: "ADULT",
        packSize: 1, packUnit: "KG", supplierType: "CONSIGNMENT",
        costPrice: 55, retailPrice: 89, isConsumable: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: "ZW-DRY-002" },
      update: {},
      create: {
        sku: "ZW-DRY-002", name: "Ziwi Peak Air-Dried Mackerel (Cat) 400g", brand: "Ziwi Peak",
        category: "food", targetSpecies: "CAT", lifeStage: "ADULT",
        packSize: 400, packUnit: "G", supplierType: "CONSIGNMENT",
        costPrice: 38, retailPrice: 62, isConsumable: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: "OP-CNS-001" },
      update: {},
      create: {
        sku: "OP-CNS-001", name: "Open Farm Surf & Turf Grain-Free (Dog) 1.8kg", brand: "Open Farm",
        category: "food", targetSpecies: "DOG", lifeStage: "ADULT",
        packSize: 1.8, packUnit: "KG", supplierType: "CONSIGNMENT",
        costPrice: 42, retailPrice: 72, isConsumable: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: "OP-CNS-002" },
      update: {},
      create: {
        sku: "OP-CNS-002", name: "Open Farm Homestead Turkey (Cat) 1.8kg", brand: "Open Farm",
        category: "food", targetSpecies: "CAT", lifeStage: "ANY",
        packSize: 1.8, packUnit: "KG", supplierType: "CONSIGNMENT",
        costPrice: 40, retailPrice: 68, isConsumable: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: "CR-JNT-001" },
      update: {},
      create: {
        sku: "CR-JNT-001", name: "Cranberry Joint Supplement (Senior Dogs)", brand: "PetVital",
        category: "supplement", targetSpecies: "DOG", lifeStage: "SENIOR",
        packSize: 60, packUnit: "COUNT", supplierType: "CONSIGNMENT",
        costPrice: 28, retailPrice: 55, isConsumable: true,
      },
    }),
    // --- TRADING (third-party, lowest margin) ---
    prisma.product.upsert({
      where: { sku: "RC-DOG-001" },
      update: {},
      create: {
        sku: "RC-DOG-001", name: "Royal Canin Maxi Adult 15kg", brand: "Royal Canin",
        category: "food", targetSpecies: "DOG", lifeStage: "ADULT",
        packSize: 15, packUnit: "KG", supplierType: "TRADING",
        costPrice: 145, retailPrice: 195, isConsumable: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: "RC-CAT-001" },
      update: {},
      create: {
        sku: "RC-CAT-001", name: "Royal Canin Indoor Cat 2kg", brand: "Royal Canin",
        category: "food", targetSpecies: "CAT", lifeStage: "ADULT",
        packSize: 2, packUnit: "KG", supplierType: "TRADING",
        costPrice: 42, retailPrice: 65, isConsumable: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: "RC-KIT-001" },
      update: {},
      create: {
        sku: "RC-KIT-001", name: "Royal Canin Kitten 2kg", brand: "Royal Canin",
        category: "food", targetSpecies: "CAT", lifeStage: "PUPPY_KITTEN",
        packSize: 2, packUnit: "KG", supplierType: "TRADING",
        costPrice: 40, retailPrice: 62, isConsumable: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: "SN-LT-001" },
      update: {},
      create: {
        sku: "SN-LT-001", name: "Snowflake Clumping Cat Litter 10L", brand: "Snowflake",
        category: "litter", targetSpecies: "CAT", lifeStage: "ANY",
        packSize: 10, packUnit: "L", supplierType: "TRADING",
        costPrice: 8, retailPrice: 15, isConsumable: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HLS-DOG-001" },
      update: {},
      create: {
        sku: "HLS-DOG-001", name: "Hills Science Diet Adult Dog 3kg", brand: "Hill's",
        category: "food", targetSpecies: "DOG", lifeStage: "ADULT",
        packSize: 3, packUnit: "KG", supplierType: "TRADING",
        costPrice: 60, retailPrice: 88, isConsumable: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HLS-SEN-001" },
      update: {},
      create: {
        sku: "HLS-SEN-001", name: "Hills Science Diet Senior Dog 11+ 3.5kg", brand: "Hill's",
        category: "food", targetSpecies: "DOG", lifeStage: "SENIOR",
        packSize: 3.5, packUnit: "KG", supplierType: "TRADING",
        costPrice: 68, retailPrice: 98, isConsumable: true,
      },
    }),
    // --- Non-consumable accessories ---
    prisma.product.upsert({
      where: { sku: "HW-BED-001" },
      update: {},
      create: {
        sku: "HW-BED-001", name: "Haiwan Memory Foam Pet Bed (M)", brand: "Haiwan",
        category: "bed", targetSpecies: "ANY", lifeStage: "ANY",
        packSize: null, packUnit: null, supplierType: "INHOUSE",
        costPrice: 45, retailPrice: 110, isConsumable: false,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HW-BED-002" },
      update: {},
      create: {
        sku: "HW-BED-002", name: "Haiwan Memory Foam Pet Bed (L)", brand: "Haiwan",
        category: "bed", targetSpecies: "ANY", lifeStage: "ANY",
        packSize: null, packUnit: null, supplierType: "INHOUSE",
        costPrice: 60, retailPrice: 138, isConsumable: false,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HW-COL-001" },
      update: {},
      create: {
        sku: "HW-COL-001", name: "Haiwan Leather Collar (S)", brand: "Haiwan",
        category: "accessory", targetSpecies: "ANY", lifeStage: "ANY",
        packSize: null, packUnit: null, supplierType: "INHOUSE",
        costPrice: 12, retailPrice: 35, isConsumable: false,
      },
    }),
    prisma.product.upsert({
      where: { sku: "KNG-TOY-001" },
      update: {},
      create: {
        sku: "KNG-TOY-001", name: "Kong Classic (M)", brand: "Kong",
        category: "accessory", targetSpecies: "DOG", lifeStage: "ANY",
        packSize: null, packUnit: null, supplierType: "TRADING",
        costPrice: 22, retailPrice: 38, isConsumable: false,
      },
    }),
    prisma.product.upsert({
      where: { sku: "FW-SCR-001" },
      update: {},
      create: {
        sku: "FW-SCR-001", name: "Feliway Scratching Post Tall", brand: "Feliway",
        category: "accessory", targetSpecies: "CAT", lifeStage: "ANY",
        packSize: null, packUnit: null, supplierType: "TRADING",
        costPrice: 35, retailPrice: 58, isConsumable: false,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HW-SHP-001" },
      update: {},
      create: {
        sku: "HW-SHP-001", name: "Haiwan Oat & Aloe Shampoo (Dog) 500ml", brand: "Haiwan",
        category: "grooming", targetSpecies: "DOG", lifeStage: "ANY",
        packSize: 500, packUnit: "ML", supplierType: "INHOUSE",
        costPrice: 10, retailPrice: 28, isConsumable: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: "RC-WET-001" },
      update: {},
      create: {
        sku: "RC-WET-001", name: "Royal Canin Wet Cat Loaf (85g × 12)", brand: "Royal Canin",
        category: "food", targetSpecies: "CAT", lifeStage: "ADULT",
        packSize: 85, packUnit: "G", supplierType: "TRADING",
        costPrice: 28, retailPrice: 42, isConsumable: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HW-PUP-001" },
      update: {},
      create: {
        sku: "HW-PUP-001", name: "Haiwan Puppy Starter Kit Bundle", brand: "Haiwan",
        category: "accessory", targetSpecies: "DOG", lifeStage: "PUPPY_KITTEN",
        packSize: null, packUnit: null, supplierType: "INHOUSE",
        costPrice: 40, retailPrice: 95, isConsumable: false,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HW-KIT-001" },
      update: {},
      create: {
        sku: "HW-KIT-001", name: "Haiwan Kitten Starter Kit Bundle", brand: "Haiwan",
        category: "accessory", targetSpecies: "CAT", lifeStage: "PUPPY_KITTEN",
        packSize: null, packUnit: null, supplierType: "INHOUSE",
        costPrice: 35, retailPrice: 85, isConsumable: false,
      },
    }),
  ]);

  const productMap: Record<string, typeof products[0]> = {};
  products.forEach((p: typeof products[0]) => { productMap[p.sku] = p; });

  // -------------------------------------------------------------------------
  // Customers + Pets
  // -------------------------------------------------------------------------
  type CreatedCustomer = Awaited<ReturnType<typeof prisma.customer.create>>;
  type CreatedPet = Awaited<ReturnType<typeof prisma.pet.create>>;

  async function makeCustomer(data: Parameters<typeof prisma.customer.create>[0]["data"]): Promise<CreatedCustomer> {
    return prisma.customer.upsert({
      where: { phone: data.phone as string },
      update: {},
      create: data as Parameters<typeof prisma.customer.create>[0]["data"],
    });
  }

  async function makePet(data: Parameters<typeof prisma.pet.create>[0]["data"]): Promise<CreatedPet> {
    return prisma.pet.create({ data });
  }

  const c1 = await makeCustomer({ phone: "60123456789", name: "Aishah Razak", email: "aishah@gmail.com", preferredStore: "KL", marketingConsent: true, consentDate: daysAgo(120), source: "WALKIN", needsDetails: false, posSpent: 4200, posTransactions: 38, posLastPurchase: daysAgo(40) });
  const c2 = await makeCustomer({ phone: "60112223344", name: "Brandon Lim", email: "brandon.lim@hotmail.com", preferredStore: "PJ", marketingConsent: true, consentDate: daysAgo(90), source: "STOREHUB", needsDetails: false, posSpent: 1800, posTransactions: 16, posLastPurchase: daysAgo(30) });
  const c3 = await makeCustomer({ phone: "60198765432", name: "Chong Wei Ling", email: null, preferredStore: "KL", marketingConsent: false, source: "WHATSAPP", needsDetails: false });
  const c4 = await makeCustomer({ phone: "60134445566", name: "Devi Nair", email: "devinair@gmail.com", preferredStore: "PJ", marketingConsent: true, consentDate: daysAgo(60), source: "WALKIN", needsDetails: false, posSpent: 1500, posTransactions: 14, posLastPurchase: daysAgo(20) });
  const c5 = await makeCustomer({ phone: "60167778899", name: "Eugene Tan", email: null, preferredStore: "KL", marketingConsent: false, source: "STOREHUB", needsDetails: false });
  const c6 = await makeCustomer({ phone: "60145556677", name: "Farah Ibrahim", email: "farah.i@yahoo.com", preferredStore: "KL", marketingConsent: true, consentDate: daysAgo(30), source: "WALKIN", needsDetails: false });
  const c7 = await makeCustomer({ phone: "60178889900", name: "Gary Ong", email: null, preferredStore: "PJ", marketingConsent: false, source: "STOREHUB", needsDetails: false });
  const c8 = await makeCustomer({ phone: "60156667788", name: "Hannah Krishnan", email: "hkrishnan@outlook.com", preferredStore: "KL", marketingConsent: true, consentDate: daysAgo(45), source: "WALKIN", needsDetails: false });
  const c9 = await makeCustomer({ phone: "60189990011", name: "Ivan Chew", email: null, preferredStore: "PJ", marketingConsent: false, source: "STOREHUB", needsDetails: false });
  const c10 = await makeCustomer({ phone: "60112334455", name: "Jasmine Yusof", email: "jasmine.y@gmail.com", preferredStore: "KL", marketingConsent: true, consentDate: daysAgo(15), source: "WHATSAPP", needsDetails: false });
  // Stub customers — needsDetails = true, created from imports
  const c11 = await makeCustomer({ phone: "60123344556", name: null, preferredStore: "NONE", marketingConsent: false, source: "STOREHUB", needsDetails: true });
  const c12 = await makeCustomer({ phone: "60134455667", name: null, preferredStore: "NONE", marketingConsent: false, source: "STOREHUB", needsDetails: true });
  const c13 = await makeCustomer({ phone: "60145566778", name: null, preferredStore: "NONE", marketingConsent: false, source: "STOREHUB", needsDetails: true });
  const c14 = await makeCustomer({ phone: "60167788990", name: "Kevin Soh", email: null, preferredStore: "PJ", marketingConsent: false, source: "STOREHUB", needsDetails: false });
  const c15 = await makeCustomer({ phone: "60178990012", name: "Lily Tan", email: "lily.tan88@gmail.com", preferredStore: "KL", marketingConsent: true, consentDate: daysAgo(5), source: "WALKIN", needsDetails: false });

  // Pets
  const p1 = await makePet({ customerId: c1.id, name: "Mochi", species: "DOG", breed: "Shih Tzu", sex: "MALE", neutered: true, dateOfBirth: new Date("2021-03-15"), adoptionDate: new Date("2021-05-01"), weightKg: 5.2, lifeStage: "ADULT", colorMarkings: "Gold & white", microchipId: "MY900012345", vetName: "PetCare Mont Kiara", allergies: "Chicken (mild)", dietaryNotes: "Prefers wet mixed with dry", notes: "Shy with strangers; loves squeaky toys" });
  const p2 = await makePet({ customerId: c1.id, name: "Oreo", species: "CAT", breed: "Domestic Shorthair", sex: "FEMALE", neutered: true, dateOfBirth: new Date("2022-07-01"), adoptionDate: new Date("2022-08-15"), weightKg: 3.8, lifeStage: "ADULT", colorMarkings: "Black & white tuxedo", vetName: "PetCare Mont Kiara", notes: "Very food-motivated" });
  const p3 = await makePet({ customerId: c2.id, name: "Rex", species: "DOG", breed: "German Shepherd", sex: "MALE", neutered: true, dateOfBirth: new Date("2018-11-20"), adoptionDate: new Date("2018-12-01"), weightKg: 32, lifeStage: "SENIOR", colorMarkings: "Black & tan", microchipId: "MY900067890", vetName: "Animal Medical Centre PJ", dietaryNotes: "Senior joint-support diet", notes: "Hip stiffness — on glucosamine" });
  const p4 = await makePet({ customerId: c3.id, name: "Luna", species: "CAT", breed: "Maine Coon", sex: "FEMALE", neutered: false, dateOfBirth: new Date("2023-02-10"), adoptionDate: new Date("2023-03-01"), weightKg: 2.1, lifeStage: "PUPPY_KITTEN", colorMarkings: "Brown tabby", vetName: "Cat Clinic KL", notes: "Energetic kitten" });
  const p5 = await makePet({ customerId: c4.id, name: "Biscuit", species: "DOG", breed: "Golden Retriever", sex: "MALE", neutered: true, dateOfBirth: new Date("2020-05-05"), weightKg: 28, lifeStage: "ADULT", colorMarkings: "Golden", microchipId: "MY900045678", vetName: "Happy Tails PJ", allergies: "Grain", dietaryNotes: "Grain-free only" });
  const p6 = await makePet({ customerId: c4.id, name: "Toffee", species: "DOG", breed: "Golden Retriever", sex: "MALE", neutered: true, dateOfBirth: new Date("2022-09-12"), weightKg: 24, lifeStage: "ADULT", colorMarkings: "Golden", vetName: "PetCare Mont Kiara", notes: "Friendly, good with kids" });
  const p7 = await makePet({ customerId: c5.id, name: "Shadow", species: "CAT", breed: "British Shorthair", sex: "MALE", neutered: true, dateOfBirth: new Date("2019-06-30"), weightKg: 5.5, lifeStage: "ADULT", colorMarkings: "Blue-grey", vetName: "Cat Clinic KL", notes: "Independent; prefers quiet" });
  const p8 = await makePet({ customerId: c6.id, name: "Snowball", species: "CAT", breed: "Persian", sex: "FEMALE", neutered: false, dateOfBirth: new Date("2024-01-20"), adoptionDate: new Date("2024-02-01"), weightKg: 1.2, lifeStage: "PUPPY_KITTEN", colorMarkings: "White longhair", vetName: "Cat Clinic KL", notes: "New kitten — first-time owner" });
  const p9 = await makePet({ customerId: c7.id, name: "Koko", species: "DOG", breed: "Beagle", sex: "MALE", neutered: true, dateOfBirth: new Date("2017-04-15"), weightKg: 11, lifeStage: "SENIOR", colorMarkings: "Tricolour", vetName: "Animal Medical Centre PJ", dietaryNotes: "Weight management", notes: "Senior beagle, mild arthritis" });
  const p10 = await makePet({ customerId: c8.id, name: "Mimi", species: "CAT", breed: "Siamese", sex: "FEMALE", neutered: true, dateOfBirth: new Date("2021-12-01"), weightKg: 3.2, lifeStage: "ADULT", colorMarkings: "Seal point", vetName: "Cat Clinic KL", notes: "Vocal Siamese" });
  const p11 = await makePet({ customerId: c9.id, name: "Bruno", species: "DOG", breed: "Labrador", sex: "MALE", neutered: true, dateOfBirth: new Date("2020-08-08"), weightKg: 30, lifeStage: "ADULT", colorMarkings: "Chocolate", microchipId: "MY900078901", vetName: "Animal Medical Centre PJ", dietaryNotes: "Weight management diet" });
  const p12 = await makePet({ customerId: c10.id, name: "Ginger", species: "CAT", breed: "Tabby", sex: "FEMALE", neutered: true, dateOfBirth: new Date("2023-11-05"), weightKg: 1.8, lifeStage: "PUPPY_KITTEN", colorMarkings: "Orange tabby", vetName: "Happy Tails PJ" });
  const p13 = await makePet({ customerId: c14.id, name: "Max", species: "DOG", breed: "Poodle", sex: "MALE", neutered: true, dateOfBirth: new Date("2022-03-22"), weightKg: 7, lifeStage: "ADULT", colorMarkings: "Apricot", vetName: "PetCare Mont Kiara", notes: "Standard poodle, very smart" });
  const p14 = await makePet({ customerId: c15.id, name: "Cleo", species: "CAT", breed: "Ragdoll", sex: "FEMALE", neutered: true, dateOfBirth: new Date("2020-10-10"), weightKg: 4.5, lifeStage: "ADULT", colorMarkings: "Seal bicolour", microchipId: "MY900090123", vetName: "Cat Clinic KL", notes: "Docile Ragdoll" });
  const p15 = await makePet({ customerId: c15.id, name: "Bolt", species: "DOG", breed: "Corgi", sex: "MALE", neutered: false, dateOfBirth: new Date("2024-04-01"), weightKg: 3.5, lifeStage: "PUPPY_KITTEN", colorMarkings: "Red & white", vetName: "Happy Tails PJ", notes: "High energy" });
  const p16 = await makePet({ customerId: c2.id, name: "Daisy", species: "DOG", breed: "Dachshund", sex: "FEMALE", neutered: true, dateOfBirth: new Date("2016-07-18"), weightKg: 8, lifeStage: "SENIOR", colorMarkings: "Tan", vetName: "Animal Medical Centre PJ", dietaryNotes: "Prone to weight gain — measured portions", notes: "Long-back breed, watch jumping" });
  const p17 = await makePet({ customerId: c5.id, name: "Ash", species: "CAT", breed: "Russian Blue", sex: "MALE", neutered: true, dateOfBirth: new Date("2022-05-14"), weightKg: 4.1, lifeStage: "ADULT", colorMarkings: "Solid grey", vetName: "Cat Clinic KL" });
  const p18 = await makePet({ customerId: c8.id, name: "Pepper", species: "DOG", breed: "Chihuahua", sex: "FEMALE", neutered: true, dateOfBirth: new Date("2018-02-28"), weightKg: 2.5, lifeStage: "SENIOR", colorMarkings: "Black", vetName: "PetCare Mont Kiara", notes: "Tiny; nervous at the vet" });
  const p19 = await makePet({ customerId: c11.id, name: "Unknown", species: "DOG", breed: null, sex: "UNKNOWN", approxAgeMonths: 36, weightKg: null, lifeStage: null, notes: "Details captured from POS import; confirm with owner" });
  const p20 = await makePet({ customerId: c13.id, name: "Kitty", species: "CAT", breed: null, sex: "UNKNOWN", approxAgeMonths: 12, weightKg: 2.8, lifeStage: "ADULT", notes: "Details captured from POS import; confirm with owner" });

  // -------------------------------------------------------------------------
  // Transactions — helper to create a transaction with lines
  // -------------------------------------------------------------------------
  async function txn(
    customer: CreatedCustomer | null,
    store: "KL" | "PJ",
    daysBack: number,
    lines: Array<{ product: typeof products[0]; pet?: CreatedPet; qty: number }>,
    storehubRef?: string,
  ) {
    const total = lines.reduce((s, l) => s + l.qty * (l.product.retailPrice ?? 0), 0);
    const t = await prisma.transaction.create({
      data: {
        customerId: customer?.id ?? null,
        store,
        transactionDate: daysAgo(daysBack),
        storehubRef: storehubRef ?? null,
        rawPhone: customer?.phone ?? null,
        totalAmount: total,
        lines: {
          create: lines.map((l) => ({
            productId: l.product.id,
            petId: l.pet?.id ?? null,
            rawProductName: l.product.name,
            quantity: l.qty,
            unitPrice: l.product.retailPrice ?? 0,
            lineTotal: l.qty * (l.product.retailPrice ?? 0),
          })),
        },
      },
    });
    return t;
  }

  const hw_fc_001 = productMap["HW-FC-001"];
  const hw_fc_002 = productMap["HW-FC-002"];
  const hw_fc_003 = productMap["HW-FC-003"];
  const hw_tr_001 = productMap["HW-TR-001"];
  const hw_lt_001 = productMap["HW-LT-001"];
  const zw_dry_001 = productMap["ZW-DRY-001"];
  const zw_dry_002 = productMap["ZW-DRY-002"];
  const op_cns_001 = productMap["OP-CNS-001"];
  const op_cns_002 = productMap["OP-CNS-002"];
  const cr_jnt_001 = productMap["CR-JNT-001"];
  const rc_dog_001 = productMap["RC-DOG-001"];
  const rc_cat_001 = productMap["RC-CAT-001"];
  const rc_kit_001 = productMap["RC-KIT-001"];
  const sn_lt_001 = productMap["SN-LT-001"];
  const hls_dog_001 = productMap["HLS-DOG-001"];
  const hls_sen_001 = productMap["HLS-SEN-001"];
  const hw_bed_001 = productMap["HW-BED-001"];
  const hw_shr_001 = productMap["HW-SHP-001"];
  const rc_wet_001 = productMap["RC-WET-001"];
  const hw_pup_001 = productMap["HW-PUP-001"];
  const hw_kit_001 = productMap["HW-KIT-001"];
  const hw_col_001 = productMap["HW-COL-001"];
  const kng_toy_001 = productMap["KNG-TOY-001"];

  // c1 — Aishah: Mochi (dog, INHOUSE food) + Oreo (cat, INHOUSE food + litter)
  // Repeat purchases at ~28-day intervals to generate good refill predictions
  await txn(c1, "KL", 168, [{ product: hw_fc_001, pet: p1, qty: 2 }, { product: hw_lt_001, pet: p2, qty: 1 }], "SH-001");
  await txn(c1, "KL", 140, [{ product: hw_fc_001, pet: p1, qty: 2 }, { product: hw_fc_002, pet: p2, qty: 1 }], "SH-002");
  await txn(c1, "KL", 112, [{ product: hw_fc_001, pet: p1, qty: 2 }, { product: hw_lt_001, pet: p2, qty: 2 }], "SH-003");
  await txn(c1, "KL", 84,  [{ product: hw_fc_001, pet: p1, qty: 2 }, { product: hw_fc_002, pet: p2, qty: 1 }], "SH-004");
  await txn(c1, "KL", 56,  [{ product: hw_fc_001, pet: p1, qty: 2 }, { product: hw_lt_001, pet: p2, qty: 1 }, { product: hw_tr_001, pet: p1, qty: 1 }], "SH-005");
  await txn(c1, "KL", 28,  [{ product: hw_fc_001, pet: p1, qty: 2 }, { product: hw_fc_002, pet: p2, qty: 1 }], "SH-006");
  // Last purchase ~28 days ago → next predicted ~now/soon
  await txn(c1, "KL", 3,   [{ product: hw_lt_001, pet: p2, qty: 1 }], "SH-007");

  // c2 — Brandon: Rex (senior dog) + Daisy (senior dog)
  await txn(c2, "PJ", 165, [{ product: hls_sen_001, pet: p3, qty: 1 }, { product: cr_jnt_001, pet: p3, qty: 1 }], "SH-008");
  await txn(c2, "PJ", 130, [{ product: hls_sen_001, pet: p3, qty: 1 }, { product: rc_dog_001, pet: p16, qty: 1 }], "SH-009");
  await txn(c2, "PJ", 95,  [{ product: hls_sen_001, pet: p3, qty: 1 }, { product: cr_jnt_001, pet: p3, qty: 1 }, { product: rc_dog_001, pet: p16, qty: 1 }], "SH-010");
  await txn(c2, "PJ", 60,  [{ product: hls_sen_001, pet: p3, qty: 1 }, { product: rc_dog_001, pet: p16, qty: 1 }], "SH-011");
  await txn(c2, "PJ", 30,  [{ product: hls_sen_001, pet: p3, qty: 1 }, { product: cr_jnt_001, pet: p3, qty: 1 }], "SH-012");
  // Due soon
  await txn(c2, "PJ", 5,   [{ product: rc_dog_001, pet: p16, qty: 1 }], "SH-013");

  // c3 — Chong Wei Ling: Luna (kitten)
  await txn(c3, "KL", 90, [{ product: rc_kit_001, pet: p4, qty: 1 }, { product: hw_kit_001, pet: p4, qty: 1 }], "SH-014");
  await txn(c3, "KL", 60, [{ product: rc_kit_001, pet: p4, qty: 1 }], "SH-015");
  await txn(c3, "KL", 30, [{ product: rc_kit_001, pet: p4, qty: 1 }, { product: hw_lt_001, pet: p4, qty: 1 }], "SH-016");
  // Litter due soon
  await txn(c3, "KL", 4,  [{ product: hw_lt_001, pet: p4, qty: 1 }], "SH-017");

  // c4 — Devi: Biscuit + Toffee (two goldens, CONSIGNMENT food)
  await txn(c4, "PJ", 155, [{ product: op_cns_001, pet: p5, qty: 1 }, { product: op_cns_001, pet: p6, qty: 1 }], "SH-018");
  await txn(c4, "PJ", 120, [{ product: op_cns_001, pet: p5, qty: 1 }, { product: op_cns_001, pet: p6, qty: 1 }, { product: hw_tr_001, pet: p5, qty: 2 }], "SH-019");
  await txn(c4, "PJ", 85,  [{ product: op_cns_001, pet: p5, qty: 1 }, { product: op_cns_001, pet: p6, qty: 1 }], "SH-020");
  await txn(c4, "PJ", 50,  [{ product: op_cns_001, pet: p5, qty: 1 }, { product: op_cns_001, pet: p6, qty: 1 }, { product: hw_bed_001, qty: 1 }], "SH-021");
  await txn(c4, "PJ", 20,  [{ product: op_cns_001, pet: p5, qty: 1 }, { product: op_cns_001, pet: p6, qty: 1 }], "SH-022");

  // c5 — Eugene: Shadow (cat) + Ash (cat, TRADING)
  await txn(c5, "KL", 145, [{ product: rc_cat_001, pet: p7, qty: 1 }, { product: sn_lt_001, pet: p7, qty: 2 }], "SH-023");
  await txn(c5, "KL", 110, [{ product: rc_cat_001, pet: p7, qty: 1 }, { product: rc_cat_001, pet: p17, qty: 1 }], "SH-024");
  await txn(c5, "KL", 75,  [{ product: rc_cat_001, pet: p7, qty: 1 }, { product: sn_lt_001, pet: p7, qty: 2 }, { product: rc_cat_001, pet: p17, qty: 1 }], "SH-025");
  await txn(c5, "KL", 40,  [{ product: rc_cat_001, pet: p7, qty: 1 }, { product: rc_cat_001, pet: p17, qty: 1 }], "SH-026");
  await txn(c5, "KL", 8,   [{ product: sn_lt_001, pet: p7, qty: 2 }], "SH-027");

  // c6 — Farah: Snowball (kitten, new pet parent)
  await txn(c6, "KL", 85,  [{ product: rc_kit_001, pet: p8, qty: 1 }, { product: hw_kit_001, pet: p8, qty: 1 }, { product: sn_lt_001, pet: p8, qty: 1 }], "SH-028");
  await txn(c6, "KL", 55,  [{ product: rc_kit_001, pet: p8, qty: 1 }, { product: sn_lt_001, pet: p8, qty: 2 }], "SH-029");
  await txn(c6, "KL", 25,  [{ product: rc_kit_001, pet: p8, qty: 1 }], "SH-030");
  await txn(c6, "KL", 2,   [{ product: sn_lt_001, pet: p8, qty: 2 }], "SH-031");

  // c7 — Gary: Koko (senior beagle)
  await txn(c7, "PJ", 160, [{ product: hls_dog_001, pet: p9, qty: 1 }, { product: cr_jnt_001, pet: p9, qty: 1 }], "SH-032");
  await txn(c7, "PJ", 125, [{ product: hls_dog_001, pet: p9, qty: 1 }], "SH-033");
  await txn(c7, "PJ", 90,  [{ product: hls_dog_001, pet: p9, qty: 1 }, { product: cr_jnt_001, pet: p9, qty: 1 }], "SH-034");
  await txn(c7, "PJ", 55,  [{ product: hls_dog_001, pet: p9, qty: 1 }], "SH-035");
  await txn(c7, "PJ", 22,  [{ product: hls_dog_001, pet: p9, qty: 1 }, { product: cr_jnt_001, pet: p9, qty: 1 }], "SH-036");

  // c8 — Hannah: Mimi (cat) + Pepper (senior chihuahua)
  await txn(c8, "KL", 150, [{ product: rc_cat_001, pet: p10, qty: 1 }, { product: hls_sen_001, pet: p18, qty: 1 }], "SH-037");
  await txn(c8, "KL", 115, [{ product: zw_dry_002, pet: p10, qty: 1 }, { product: hls_sen_001, pet: p18, qty: 1 }], "SH-038");
  await txn(c8, "KL", 80,  [{ product: zw_dry_002, pet: p10, qty: 1 }, { product: hls_sen_001, pet: p18, qty: 1 }, { product: hw_tr_001, pet: p10, qty: 1 }], "SH-039");
  await txn(c8, "KL", 45,  [{ product: zw_dry_002, pet: p10, qty: 1 }, { product: hls_sen_001, pet: p18, qty: 1 }], "SH-040");
  await txn(c8, "KL", 10,  [{ product: zw_dry_002, pet: p10, qty: 1 }], "SH-041");

  // c9 — Ivan: Bruno (lab, Ziwi consignment)
  await txn(c9, "PJ", 155, [{ product: zw_dry_001, pet: p11, qty: 1 }, { product: kng_toy_001, pet: p11, qty: 1 }], "SH-042");
  await txn(c9, "PJ", 120, [{ product: zw_dry_001, pet: p11, qty: 1 }], "SH-043");
  await txn(c9, "PJ", 85,  [{ product: zw_dry_001, pet: p11, qty: 1 }, { product: hw_tr_001, pet: p11, qty: 2 }], "SH-044");
  await txn(c9, "PJ", 50,  [{ product: zw_dry_001, pet: p11, qty: 1 }], "SH-045");
  await txn(c9, "PJ", 18,  [{ product: zw_dry_001, pet: p11, qty: 1 }], "SH-046");

  // c10 — Jasmine: Ginger (kitten, new pet parent)
  await txn(c10, "KL", 70, [{ product: rc_kit_001, pet: p12, qty: 1 }, { product: hw_kit_001, pet: p12, qty: 1 }], "SH-047");
  await txn(c10, "KL", 40, [{ product: rc_kit_001, pet: p12, qty: 1 }, { product: hw_lt_001, pet: p12, qty: 1 }], "SH-048");
  await txn(c10, "KL", 10, [{ product: rc_kit_001, pet: p12, qty: 1 }], "SH-049");

  // c11 — stub customer
  await txn(c11, "PJ", 50,  [{ product: rc_dog_001, pet: p19, qty: 1 }], "SH-050");
  await txn(c11, "PJ", 20,  [{ product: rc_dog_001, pet: p19, qty: 1 }], "SH-051");

  // c12 — stub customer (single purchase, over 30 days ago — due soon via default)
  await txn(c12, "KL", 33, [{ product: rc_cat_001, qty: 1 }], "SH-052");

  // c13 — stub customer
  await txn(c13, "KL", 60, [{ product: sn_lt_001, pet: p20, qty: 2 }], "SH-053");
  await txn(c13, "KL", 28, [{ product: sn_lt_001, pet: p20, qty: 2 }, { product: op_cns_002, pet: p20, qty: 1 }], "SH-054");
  await txn(c13, "KL", 3,  [{ product: op_cns_002, pet: p20, qty: 1 }], "SH-055");

  // c14 — Kevin: Max (poodle)
  await txn(c14, "PJ", 130, [{ product: hw_fc_001, pet: p13, qty: 1 }, { product: hw_col_001, pet: p13, qty: 1 }], "SH-056");
  await txn(c14, "PJ", 100, [{ product: hw_fc_001, pet: p13, qty: 1 }, { product: hw_shr_001, pet: p13, qty: 1 }], "SH-057");
  await txn(c14, "PJ", 70,  [{ product: hw_fc_001, pet: p13, qty: 1 }], "SH-058");
  await txn(c14, "PJ", 40,  [{ product: hw_fc_001, pet: p13, qty: 1 }, { product: hw_shr_001, pet: p13, qty: 1 }], "SH-059");
  await txn(c14, "PJ", 10,  [{ product: hw_fc_001, pet: p13, qty: 1 }], "SH-060");

  // c15 — Lily: Cleo (cat) + Bolt (puppy corgi, new pet parent)
  await txn(c15, "KL", 110, [{ product: op_cns_002, pet: p14, qty: 1 }, { product: hw_pup_001, pet: p15, qty: 1 }], "SH-061");
  await txn(c15, "KL", 80,  [{ product: op_cns_002, pet: p14, qty: 1 }, { product: hw_fc_003, pet: p15, qty: 1 }], "SH-062");
  await txn(c15, "KL", 50,  [{ product: op_cns_002, pet: p14, qty: 1 }, { product: hw_fc_003, pet: p15, qty: 1 }, { product: hw_lt_001, pet: p14, qty: 1 }], "SH-063");
  await txn(c15, "KL", 22,  [{ product: op_cns_002, pet: p14, qty: 1 }, { product: hw_fc_003, pet: p15, qty: 1 }], "SH-064");
  await txn(c15, "KL", 4,   [{ product: hw_lt_001, pet: p14, qty: 1 }], "SH-065");

  // Unmatched transactions (no customer)
  await txn(null, "KL", 45, [{ product: rc_cat_001, qty: 1 }, { product: sn_lt_001, qty: 1 }]);
  await txn(null, "PJ", 30, [{ product: rc_dog_001, qty: 1 }]);
  await txn(null, "KL", 12, [{ product: hw_fc_001, qty: 1 }, { product: hw_tr_001, qty: 2 }]);

  // -------------------------------------------------------------------------
  // Subscriptions
  // -------------------------------------------------------------------------
  await prisma.subscription.create({
    data: {
      customerId: c1.id, petId: p1.id, productId: hw_fc_001.id,
      // Already due — the dashboard/cron reconcile raises a SUBSCRIPTION_DUE task
      // for this on first load, and Aishah's manual refill for this product is
      // suppressed (managed by the subscription instead).
      intervalDays: 28, nextDueDate: addDays(new Date(), -1), status: "ACTIVE",
    },
  });
  await prisma.subscription.create({
    data: {
      customerId: c4.id, petId: p5.id, productId: op_cns_001.id,
      intervalDays: 35, nextDueDate: addDays(new Date(), 15), status: "ACTIVE",
    },
  });
  await prisma.subscription.create({
    data: {
      customerId: c9.id, petId: p11.id, productId: zw_dry_001.id,
      intervalDays: 30, nextDueDate: addDays(new Date(), 12), status: "ACTIVE",
    },
  });
  await prisma.subscription.create({
    data: {
      customerId: c2.id, petId: p3.id, productId: hls_sen_001.id,
      intervalDays: 35, nextDueDate: addDays(new Date(), 5), status: "ACTIVE",
    },
  });
  await prisma.subscription.create({
    data: {
      customerId: c8.id, petId: p18.id, productId: hls_sen_001.id,
      intervalDays: 35, nextDueDate: addDays(new Date(), -5), status: "PAUSED",
    },
  });

  // -------------------------------------------------------------------------
  // Action Inbox tasks (Phase 1) — a spread of types so the inbox is populated.
  // -------------------------------------------------------------------------
  function hoursFromNow(h: number): Date {
    return new Date(Date.now() + h * 60 * 60 * 1000);
  }

  await prisma.task.createMany({
    data: [
      // A fresh lead captured at the counter (SOP §5), due in ~20h.
      {
        type: "LEAD_FOLLOWUP", source: "SOP_LEAD", channel: "WALKIN", store: "KL",
        customerId: c6.id, holdItem: "Persian kitten starter kit",
        note: "First-time owner, asked about litter training", dueAt: hoursFromNow(20),
      },
      // An active 24h hold (SOP §6) with ~6h left on the clock.
      {
        type: "HOLD", source: "SOP_HOLD", channel: "WALKIN", store: "PJ",
        customerId: c2.id, holdItem: "Royal Canin Maxi Adult 15kg",
        holdExpiresAt: hoursFromNow(6), dueAt: hoursFromNow(6),
      },
      // A hold that has ALREADY lapsed — the dashboard sweep will flip this to
      // EXPIRED on first load and spawn a courtesy follow-up, demonstrating the
      // close-the-loop behaviour.
      {
        type: "HOLD", source: "SOP_HOLD", channel: "WALKIN", store: "KL",
        customerId: c10.id, holdItem: "Feliway Scratching Post",
        holdExpiresAt: hoursFromNow(-2), dueAt: hoursFromNow(-2),
      },
      // An inbound WhatsApp inquiry awaiting a first reply.
      {
        type: "INQUIRY", source: "MANUAL", channel: "WHATSAPP", store: "NONE",
        customerId: c3.id, note: "Asked if we stock grain-free kitten food", dueAt: hoursFromNow(18),
      },
    ],
  });

  // -------------------------------------------------------------------------
  // Membership backfill (Phase 2) — customers with consent + >=1 pet are treated
  // as already-claimed (ACTIVE) and assigned an HW-##### memberId. Lapse status
  // is then reconciled on the dashboard/members page (no purchase in 90d).
  // -------------------------------------------------------------------------
  const allForMembership = await prisma.customer.findMany({
    include: { pets: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
  });
  let memberSeq = 0;
  let activated = 0;
  for (const c of allForMembership) {
    if (c.marketingConsent && c.pets.length > 0) {
      memberSeq++;
      const when = c.consentDate ?? c.createdAt;
      await prisma.customer.update({
        where: { id: c.id },
        data: {
          memberStatus: "ACTIVE",
          memberId: `HW-${String(memberSeq).padStart(5, "0")}`,
          joinDate: when,
          claimedDate: when,
        },
      });
      activated++;
    }
  }
  // Give a couple of activated members some points so the points UI isn't all 0.
  await prisma.customer.updateMany({ where: { memberStatus: "ACTIVE" }, data: { pointsBalance: 120 } });

  // -------------------------------------------------------------------------
  // Brand pipeline backfill (Phase 4) — one Brand per distinct product brand,
  // products linked via brandId. A couple are put in TRIAL (one past 90 days to
  // demonstrate the auto BRAND_REVIEW task) with varied owner/status/fit.
  // -------------------------------------------------------------------------
  const brandNames = Array.from(new Set(products.map((p) => p.brand).filter((b): b is string => !!b)));
  const owners = ["Dini", "Jeany", "Dannie", "Win Nie", "Evi"];
  const overrides: Record<string, { status?: string; trialDaysAgo?: number; fit?: string; nextStep?: string }> = {
    "Ziwi Peak": { status: "TRIAL", trialDaysAgo: 100, fit: "HIGH", nextStep: "90-day review — decide keep / drop / co-create" },
    "Open Farm": { status: "TRIAL", trialDaysAgo: 30, fit: "CONDITIONAL", nextStep: "Monitor sell-through" },
    PetVital: { status: "IN_TALKS", fit: "VERIFY", nextStep: "Awaiting sample pack" },
    Feliway: { status: "PROSPECT", fit: "SKIP" },
    Haiwan: { status: "ACTIVE", fit: "HIGH" },
  };
  let bi = 0;
  let brandCount = 0;
  for (const name of brandNames) {
    const firstProd = products.find((p) => p.brand === name)!;
    const ov = overrides[name] ?? {};
    const st = firstProd.supplierType;
    const brand = await prisma.brand.upsert({
      where: { name },
      update: {},
      create: {
        name,
        supplierType: st as "TRADING" | "CONSIGNMENT" | "INHOUSE",
        status: (ov.status as "PROSPECT" | "IN_TALKS" | "TRIAL" | "ACTIVE" | "DROPPED") ?? "ACTIVE",
        owner: owners[bi % owners.length],
        aestheticFit: (ov.fit as "HIGH" | "CONDITIONAL" | "VERIFY" | "SKIP") ?? "VERIFY",
        nextStep: ov.nextStep ?? null,
        trialStartDate: ov.trialDaysAgo != null ? daysAgo(ov.trialDaysAgo) : null,
        commissionPct: st === "CONSIGNMENT" ? 25 : null,
        listingFee: st === "TRADING" ? 200 : null,
      },
    });
    await prisma.product.updateMany({ where: { brand: name }, data: { brandId: brand.id } });
    bi++;
    brandCount++;
  }

  console.log("✓ Seed complete.");
  console.log(`  Customers: 15 | Pets: 20 | Products: ${products.length} | Subscriptions: 5 | Tasks: 4 | Members activated: ${activated} | Brands: ${brandCount}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
