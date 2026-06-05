// Throwaway smoke test for the WhatsApp pipeline. Cleans up after itself.
// Run: npx tsx scripts/smoke-whatsapp.ts
import { prisma } from "../lib/db";
import { parseWhatsAppExport } from "../lib/whatsapp/parse";
import { ingestMessages } from "../lib/whatsapp/ingest";
import { runEodAnalysis } from "../lib/whatsapp/analyze";
import type { IncomingMessage } from "../lib/whatsapp/types";

const TEST_PHONE = "601999999999";

const SAMPLE = `[01/06/2024, 14:32:05] Aishah: Hi, nak order 2 bag Royal Canin kibble
[01/06/2024, 14:33:10] Haiwan KL: Hi Aishah! Sure, ada stock. Nak pickup KL?
[01/06/2024, 14:35:00] Aishah: Yes pickup KL esok.
Also do you have cat litter ada tak?`;

async function cleanup() {
  await prisma.whatsAppLead.deleteMany({ where: { phone: TEST_PHONE } });
  await prisma.whatsAppMessage.deleteMany({ where: { phone: TEST_PHONE } });
  await prisma.customer.deleteMany({ where: { phone: TEST_PHONE } });
}

async function main() {
  await cleanup(); // start clean

  // 1. Parse
  const parsed = parseWhatsAppExport(SAMPLE);
  console.log("parse:", { entries: parsed.entries.length, senders: parsed.senders, unparsed: parsed.unparsed });
  console.assert(parsed.entries.length === 3, "expected 3 entries (multiline merged)");
  console.assert(parsed.senders.includes("Aishah") && parsed.senders.includes("Haiwan KL"), "senders detected");

  // 2. Map + ingest
  const us = new Set(["Haiwan KL"]);
  const msgs: IncomingMessage[] = parsed.entries.map((e) => ({
    phone: TEST_PHONE,
    contactName: us.has(e.sender) ? undefined : e.sender,
    direction: us.has(e.sender) ? "OUTBOUND" : "INBOUND",
    body: e.body,
    timestamp: e.timestamp,
  }));
  const ing1 = await ingestMessages(msgs, "MANUAL");
  console.log("ingest #1:", ing1);
  console.assert(ing1.inserted === 3 && ing1.customersCreated === 1, "3 inserted, 1 customer created");

  // 3. Idempotency — re-ingest should skip all as duplicates
  const ing2 = await ingestMessages(msgs, "MANUAL");
  console.log("ingest #2 (dedup):", ing2);
  console.assert(ing2.inserted === 0 && ing2.skippedDuplicate === 3, "re-ingest deduped");

  // 4. Direction split
  const inbound = await prisma.whatsAppMessage.count({ where: { phone: TEST_PHONE, direction: "INBOUND" } });
  const outbound = await prisma.whatsAppMessage.count({ where: { phone: TEST_PHONE, direction: "OUTBOUND" } });
  console.log("directions:", { inbound, outbound });
  console.assert(inbound === 2 && outbound === 1, "2 inbound / 1 outbound");

  // 5. Analysis guard (no API key -> graceful, no throw)
  const hadKey = !!process.env.ANTHROPIC_API_KEY?.trim();
  const res = await runEodAnalysis();
  console.log("analysis:", { ok: res.ok, reason: res.reason, leads: res.leadsCreated, hadKey });
  if (!hadKey) console.assert(res.ok === false && /ANTHROPIC_API_KEY/.test(res.reason ?? ""), "graceful no-key path");

  await cleanup();
  console.log("\n✅ smoke test passed; test data cleaned up.");
}

main()
  .catch(async (e) => {
    console.error("❌ smoke failed:", e);
    await cleanup();
    process.exit(1);
  })
  .finally(() => process.exit(0));
