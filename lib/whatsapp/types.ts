// =============================================================================
// WhatsApp ingestion — shared types and the pluggable adapter contract.
//
// The CRM stores WhatsApp messages in ONE table regardless of where they came
// from. An "ingestion adapter" is anything that turns a raw source (a pasted
// chat export today; a Cloud API webhook / unofficial bridge / BSP provider
// later) into a list of `IncomingMessage`s. ingest() in ./ingest.ts does the
// rest (phone normalisation, customer linking, dedup, persistence).
//
// To add a live source later, implement `IngestionAdapter` and feed its output
// to ingestMessages() — nothing in storage or analysis needs to change.
// =============================================================================

import type { WhatsAppSource } from "../../app/generated/prisma/client";

/** A single message in source-neutral form, before persistence. */
export interface IncomingMessage {
  /** Phone of the OTHER party (the customer), raw or canonical — normalised on ingest. */
  phone: string;
  /** WhatsApp profile / saved contact name, if the source exposes it. */
  contactName?: string;
  /** Relative to Haiwan: a customer message is INBOUND, our reply is OUTBOUND. */
  direction: "INBOUND" | "OUTBOUND";
  /** Message text. Media/attachments are represented by their caption or a placeholder. */
  body: string;
  /** When the message was sent. */
  timestamp: Date;
  /** Stable per-message id from the source, if any — makes re-ingestion idempotent. */
  externalId?: string;
}

/**
 * Contract for a live message source. Implement this for Cloud API / bridge /
 * provider integrations. `pull` returns messages newer than `since` (for poll
 * based sources); push-based sources (webhooks) can instead call
 * ingestMessages() directly from their route handler.
 */
export interface IngestionAdapter {
  /** Identifies which WhatsAppSource these messages should be tagged with. */
  readonly source: WhatsAppSource;
  /** Human-readable name for logs/UI. */
  readonly name: string;
  /** Optional poll: fetch messages newer than `since`. */
  pull?(since: Date | null): Promise<IncomingMessage[]>;
}

export interface IngestSummary {
  inserted: number;
  skippedDuplicate: number;
  customersMatched: number; // linked to an existing Customer
  customersCreated: number; // stub Customer auto-created (source WHATSAPP)
  errors: string[];
}
