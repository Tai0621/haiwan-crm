# Haiwan CRM — Integration Upgrade Plan

> Canonical, version-controlled copy of the build plan. The CRM is a live,
> deployed interim system (Next.js + Prisma + Turso on Vercel). The goal of this
> work is to make it **drive actions and close loops**, not just record history.
> A separate team builds the permanent platform later, so every change keeps the
> data clean and fully exportable.

## Working rules (every phase)

- **Additive migrations only** — never drop/rename existing columns without
  explicit approval. (For SQLite/Turso, hand-author `ALTER TABLE ADD COLUMN`
  rather than Prisma's default table-rebuild, and apply to prod via the Turso
  HTTP `/v2/pipeline`.)
- Never break a working screen. No hardcoded secrets — env vars only.
- Keep a CSV/JSON export path for every new table.
- Per phase: propose migration + screens → confirm → implement → deploy to
  Vercel → hand over a short "click here, expect this" test script.
- No real customer PII in testing — use sample/seed data.

## Phase status

| Phase | Title | Status |
|------|-------|--------|
| 0 | Discovery & safety | ✅ Done |
| 1 | Action Inbox + SOP loop | ✅ Built, verified, **deployed live** |
| 2 | Membership status as the spine | ✅ Built, verified, committed (deploy pending review) |
| 3 | Consumption→subscription bridge | ⬜ Planned |
| 4 | Supplier & consignment pipeline | ⬜ Planned |
| 5 | Margin & revenue-mix reconciliation | ⬜ Planned |
| 6 | Live WhatsApp (both stores) + scaled outreach | ⬜ Planned — **expanded below** |

---

## Phase 1 — Action Inbox + SOP loop ✅

A single dueAt-sorted "what to do now" list (new `Task` entity) that staff work
from, fed by the refill engine and the store SOP capture moments (lead capture,
24h holds, inquiry intake), with one-tap WhatsApp click-to-chat templates.
Refill predictions stay computed live with a `RefillOverlay` for done/snooze.
Customer profiles show an "Action needed" card. *Deployed.*

## Phase 2 — Membership status as the spine ✅

`Customer.memberStatus` (PROSPECT/ACTIVE/LAPSED) becomes the field everything
reads from; `memberId` (HW-#####), `joinDate`, `claimedDate`, `pointsBalance`,
computed tier (Member/Silver/Gold on lifetime spend, editable in
`lib/membership.ts`). Claim = activation = enrichment. `/members` hub +
profile membership card; lapse→WINBACK reconcile on dashboard + cron. StoreHub
loyalty mirrored for reconciliation. *Committed; deploy pending review.*

## Phase 3 — Consumption→subscription bridge ⬜

"Convert to subscription" on a refill creates a `Subscription` (interval =
predicted gap), schedules `SUBSCRIPTION_DUE` tasks, and feeds a recurring-revenue
figure. (`Subscription` model + `/subscriptions` already exist.)

## Phase 4 — Supplier & consignment pipeline ⬜

New `Brand` entity (supplierType, status, owner, terms, trial dates,
aestheticFit) linked to `Product.brandId`. Pipeline board, 90-day trial tracker
(sell-through, repurchase, basket adjacency → `BRAND_REVIEW` task at day 90),
"convert to in-house" report.

## Phase 5 — Margin & revenue-mix reconciliation ⬜

Make monthly revenue-by-supplier-type the single source of truth; add **margin**
(COGS/gross profit from `product.costPrice`); finance view exportable to
CSV/XLSX with unclassified-line reconciliation gap; target in-house % tracking.

---

## Phase 6 — Live WhatsApp (both stores) + scaled outreach ⬜

> **Expanded** to include linking **both store WhatsApp Business numbers (KL +
> PJ)** for live inbound ingestion with **per-store attribution**, so the
> existing end-of-day analysis runs automatically on real chats, attributable to
> the store that received them. Split into **6a (inbound)** and **6b (outbound)**.
> Still gated behind Phases 1–5 and a Meta/BSP account; PDPA applies throughout.

### Where things stand today (baseline)

- Ingestion is **source-agnostic** (`WhatsAppSource`: MANUAL / CLOUD_API /
  BRIDGE / PROVIDER) but **only manual paste is in use** (`/whatsapp/import`).
- A working **Cloud API inbound webhook** exists (`/api/whatsapp/webhook`) but
  the live feed is **not configured** (`WHATSAPP_VERIFY_TOKEN` /
  `WHATSAPP_APP_SECRET` aren't in `.env.example`/`DEPLOY.md`).
- **No per-store concept**: messages live in one table keyed by the customer's
  phone; the parser (`lib/whatsapp/cloud-api.ts`) currently **discards** the
  webhook's `value.metadata.phone_number_id` — which is exactly the field that
  identifies *which Haiwan number* received the chat.
- The **EOD cron is scheduled** (`0 16 * * *` = midnight MYT → `eod-analysis`)
  and analyzes any unanalyzed INBOUND messages with Claude — but finds nothing
  unless messages are ingested.

### 6a — Inbound: connect both store numbers + per-store attribution + nightly analysis

**Goal:** customer chats to either store flow into the CRM automatically and are
analyzed nightly into leads (which become Action-Inbox `INQUIRY`/lead items),
each tagged with the store that received it.

**Data model (additive):**
- `WhatsAppMessage`: add `store` (`Store` enum KL|PJ|NONE) and `businessNumber`
  (the Haiwan WABA number / `phone_number_id` that received it).
- `WhatsAppLead`: add `store`, carried from its source messages, so leads and the
  inbox filter by store (Phase 1's inbox already has store filters).
- Optional `WhatsAppNumber` config (or env map) resolving `phone_number_id` →
  `store` + display number, so adding/retiring a store number is config-only.

**Behaviour:**
- Register **both** stores' numbers in Meta (one WABA can hold multiple numbers;
  both point their webhook at the same `/api/whatsapp/webhook`).
- Extend `parseCloudApiWebhook` to read `value.metadata.phone_number_id` /
  `display_phone_number`; `ingestMessages` maps it → store and stamps
  `store` + `businessNumber` on each message.
- EOD analysis is unchanged in shape (groups by customer); generated leads
  inherit `store`. Inbox `INQUIRY`/lead tasks created from WhatsApp carry the
  correct store automatically.
- `/whatsapp` page: per-store message/lead counts and a store filter.

**Setup prerequisites (operational, not code):**
- Meta WhatsApp Business Platform (WABA) with **both** KL and PJ numbers
  registered (or a BSP managing both). Env: `WHATSAPP_VERIFY_TOKEN`,
  `WHATSAPP_APP_SECRET`, `ANTHROPIC_API_KEY`, plus a `phone_number_id → store`
  map (e.g. `WHATSAPP_NUMBER_KL`, `WHATSAPP_NUMBER_PJ`). All server-side.
- **PDPA:** storing inbound customer chats requires a retention/consent stance;
  document it. Inbound capture ≠ marketing consent.

**Acceptance:** a customer messages the KL number; within the day the chat is
ingested, the EOD run extracts a lead tagged **KL**, and it appears in the Action
Inbox filtered to KL with the customer linked.

### 6b — Outbound: scaled, opt-in templated messaging (original Phase 6 scope)

**Goal:** scale outreach beyond manual click-to-chat, safely. Only after 6a is
solid. Integrate a BSP for **approved, opt-in template messages** driven by the
action lists (refills, activations, lapsing members). Strict gates: send only to
customers with **marketing consent**; **pre-approved templates** only; keep a
**send log**; **human approval on every batch**; **no cold broadcasting**;
per-store sending uses the matching store number; all provider keys server-side.

**Acceptance:** from an action list, staff approve a batch; only consented
customers receive a pre-approved template from their store's number; every send
is logged and attributable.

---

## Build order

0 → 1 → 2 → 3 → 4 → 5 → 6 (6a before 6b). Phases 1–2 are the foundation the rest
read from; 3 is high-impact/small; 4–5 build on cleaned data; 6 (live WhatsApp)
is last and depends on a Meta/BSP account.
