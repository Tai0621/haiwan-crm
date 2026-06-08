// =============================================================================
// WhatsApp Cloud API (Meta WhatsApp Business Platform) ingestion adapter.
//
// Turns an incoming webhook payload into source-neutral IncomingMessage[] for
// ingestMessages(..., "CLOUD_API"). Only INBOUND customer messages arrive via
// the Cloud API webhook (the business's own replies are NOT delivered), so
// every parsed message has direction "INBOUND".
//
// Payload reference:
//   https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
// =============================================================================

import type { IncomingMessage } from "./types";

interface WaProfile {
  name?: string;
}
interface WaContact {
  wa_id?: string;
  profile?: WaProfile;
}
interface WaMedia {
  caption?: string;
  filename?: string;
}
interface WaText {
  body?: string;
}
interface WaButton {
  text?: string;
}
interface WaInteractive {
  button_reply?: { title?: string };
  list_reply?: { title?: string };
}
interface WaLocation {
  name?: string;
}
interface WaMessage {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: WaText;
  image?: WaMedia;
  video?: WaMedia;
  audio?: WaMedia;
  document?: WaMedia;
  sticker?: WaMedia;
  button?: WaButton;
  interactive?: WaInteractive;
  location?: WaLocation;
}
interface WaValue {
  messaging_product?: string;
  contacts?: WaContact[];
  messages?: WaMessage[];
}
interface WaChange {
  value?: WaValue;
  field?: string;
}
interface WaEntry {
  id?: string;
  changes?: WaChange[];
}
interface WaWebhook {
  object?: string;
  entry?: WaEntry[];
}

/** Best-effort human-readable body — media/non-text become a labelled placeholder. */
function messageBody(m: WaMessage): string {
  switch (m.type) {
    case "text":
      return m.text?.body?.trim() || "[empty message]";
    case "image":
      return m.image?.caption ? `[image] ${m.image.caption}` : "[image]";
    case "video":
      return m.video?.caption ? `[video] ${m.video.caption}` : "[video]";
    case "document":
      return m.document?.caption
        ? `[document] ${m.document.caption}`
        : `[document${m.document?.filename ? ` ${m.document.filename}` : ""}]`;
    case "audio":
      return "[voice message]";
    case "sticker":
      return "[sticker]";
    case "location":
      return `[location${m.location?.name ? ` ${m.location.name}` : ""}]`;
    case "button":
      return m.button?.text ? `[button] ${m.button.text}` : "[button]";
    case "interactive":
      return (
        m.interactive?.button_reply?.title ||
        m.interactive?.list_reply?.title ||
        "[interactive reply]"
      );
    default:
      return `[${m.type ?? "unknown"}]`;
  }
}

/**
 * Parse a Meta Cloud API webhook payload into IncomingMessages.
 * Returns [] for non-message callbacks (delivery statuses, etc.).
 */
export function parseCloudApiWebhook(payload: unknown): IncomingMessage[] {
  const body = payload as WaWebhook;
  if (body?.object !== "whatsapp_business_account") return [];

  const out: IncomingMessage[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages?.length) continue; // statuses-only callback, skip

      // wa_id -> profile name, so we can attach contactName per message.
      const names = new Map<string, string>();
      for (const c of value.contacts ?? []) {
        if (c.wa_id && c.profile?.name) names.set(c.wa_id, c.profile.name);
      }

      for (const m of value.messages) {
        if (!m.from || !m.timestamp) continue;
        const tsSeconds = Number(m.timestamp);
        out.push({
          phone: m.from,
          contactName: names.get(m.from),
          direction: "INBOUND",
          body: messageBody(m),
          timestamp: Number.isFinite(tsSeconds) ? new Date(tsSeconds * 1000) : new Date(),
          externalId: m.id,
        });
      }
    }
  }
  return out;
}
