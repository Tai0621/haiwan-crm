// =============================================================================
// Persist IncomingMessages into the WhatsAppMessage table.
//
// Source-agnostic: the same path serves the manual chat-export importer today
// and any live adapter (Cloud API / bridge / provider) later. Responsibilities:
//   • normalise the customer phone to canonical "60xxxxxxxxx"
//   • link to an existing Customer, or create a WHATSAPP stub (needsDetails)
//   • dedup — by externalId when present, else by (phone, timestamp, body)
//
// Returns a summary mirroring the StoreHub importer's style.
// =============================================================================

import { prisma } from "../db";
import { normalizePhone } from "../phone";
import type { IncomingMessage, IngestSummary } from "./types";
import type { WhatsAppSource } from "../../app/generated/prisma/client";

export async function ingestMessages(
  messages: IncomingMessage[],
  source: WhatsAppSource,
): Promise<IngestSummary> {
  const summary: IngestSummary = {
    inserted: 0,
    skippedDuplicate: 0,
    customersMatched: 0,
    customersCreated: 0,
    errors: [],
  };

  // Resolve each distinct phone -> customerId once.
  const customerCache = new Map<string, string>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const phone = normalizePhone(msg.phone);
    if (!phone) {
      summary.errors.push(`Message ${i + 1}: unusable phone "${msg.phone}" — skipped.`);
      continue;
    }

    try {
      // ---- Resolve / create customer ----
      let customerId = customerCache.get(phone);
      if (!customerId) {
        const existing = await prisma.customer.findUnique({ where: { phone } });
        if (existing) {
          customerId = existing.id;
          summary.customersMatched++;
        } else {
          const stub = await prisma.customer.create({
            data: {
              phone,
              name: msg.contactName ?? null,
              source: "WHATSAPP",
              needsDetails: true,
            },
          });
          customerId = stub.id;
          summary.customersCreated++;
        }
        customerCache.set(phone, customerId);
      }

      // ---- Dedup ----
      if (msg.externalId) {
        const dup = await prisma.whatsAppMessage.findUnique({
          where: { externalId: msg.externalId },
        });
        if (dup) {
          summary.skippedDuplicate++;
          continue;
        }
      } else {
        // No stable id (manual export): treat same phone+timestamp+body as dup
        // so re-pasting the same chat is idempotent.
        const dup = await prisma.whatsAppMessage.findFirst({
          where: { phone, timestamp: msg.timestamp, body: msg.body, direction: msg.direction },
          select: { id: true },
        });
        if (dup) {
          summary.skippedDuplicate++;
          continue;
        }
      }

      await prisma.whatsAppMessage.create({
        data: {
          customerId,
          phone,
          rawPhone: msg.phone !== phone ? msg.phone : null,
          contactName: msg.contactName ?? null,
          direction: msg.direction,
          body: msg.body,
          timestamp: msg.timestamp,
          source,
          externalId: msg.externalId ?? null,
        },
      });
      summary.inserted++;
    } catch (e) {
      summary.errors.push(`Message ${i + 1} (${phone}): ${(e as Error).message}`);
    }
  }

  return summary;
}
