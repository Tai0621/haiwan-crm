# Haiwan CRM — Upgrade Plan 2: "Did it work?"

> Successor to [UPGRADE_PLAN.md](UPGRADE_PLAN.md). Plan 1 made the CRM **drive
> actions and close loops** — the Action Inbox, membership spine, subscriptions,
> brand pipeline, finance view, shift SOP, and two-role access are all live.
> Plan 2 finishes the original promise: the CRM should answer **"what should we
> do right now, AND did it work?"** — measurement, accountability, and the
> revenue behaviours that sit dormant in the data we already collect.
>
> Still an interim system. Same rules as Plan 1: additive migrations only,
> never break a working screen, no hardcoded secrets, CSV export for every new
> table, per-phase deploy + test script, sample data only in testing, ask
> before adding any dependency.

## Where v1 left off

| Live | Deferred / carried over |
|------|------------------------|
| Action Inbox + SOP capture (leads, holds, inquiries, refills) | Counter SOP page (designed + mocked, build pending) |
| Membership spine (PROSPECT/ACTIVE/LAPSED, tiers, HW-#####) | Live two-store WhatsApp (6a/6b — gated on Meta/BSP account) |
| Subscription bridge + recurring revenue | |
| Brand pipeline + 90-day trials | |
| Finance margin/mix vs target | |
| Shift checklist SOP (editable, branch-aware, logged) | |
| Two roles (management / frontline) | |

## The gaps this plan closes

1. **No outcome measurement.** Staff clear tasks, but nothing records whether
   the refill nudge led to a purchase, the win-back brought anyone back, or the
   activation converted. The dashboard shows effort, not results.
2. **No branch lens.** Two stores, one blended number. `Transaction.store`
   exists on every sale but no report splits KL vs PJ.
3. **No staff attribution.** Shared logins mean tasks are completed by
   "someone". Shift sign-offs capture a name; tasks don't.
4. **Dormant loyalty.** `pointsBalance` exists but is manual-only — no earn
   rules, no redemption log, nothing for staff to say at the counter.
5. **Dormant lifecycle data.** Pet birthdays (template already written!), new
   pet parents, senior pets — segmented but never actioned.
6. **The reconciliation gap has no tool.** Unmatched transaction lines show as
   UNCLASSIFIED on the finance view, but fixing them means editing data by hand.
7. **Stock and demand never meet.** Wix stock is synced; refills and
   subscriptions predict demand; nobody is told when a due refill is out of stock.

---

## Phase 1 — Outcome tracking: the "did it work?" engine

**Goal:** every outreach task records what happened next, and the dashboard
shows conversion, not just completion.

**Data model (additive):**
- `Task.outcome` (enum: `CONVERTED`, `NO_RESPONSE`, `DECLINED`, `NOT_RELEVANT`,
  null = not yet known) + `Task.outcomeAt`.
- No new tables. Attribution is computed: a customer-linked task marked DONE is
  `CONVERTED` if that customer has a transaction within N days (default 14,
  config constant) after `completedAt` — auto-stamped by a reconcile sweep
  (same pattern as holds/memberships/subscriptions), with a manual override
  on the task row for walk-in conversions the sync can't see.

**Screens:**
- Inbox rows gain a quiet outcome tag once known.
- **Results panel** on the dashboard (management): last 30/90 days — refill
  nudges sent → converted %, win-backs → returned %, activations → claimed %,
  holds → collected %. The four loops, each with a number.
- Customer detail: outcomes appear in the "Action needed" card history.

**Acceptance:** management can say "we sent 40 refill nudges last month and 22
bought within two weeks" without leaving the dashboard.

## Phase 2 — Branch & staff accountability

**Goal:** see KL and PJ as two businesses, and know who did what — without
building real user accounts.

**Data model (additive):**
- `StaffMember` table (name, branch, active) — seeded with the current team;
  editable by management (same pattern as the SOP editor).
- `Task.completedBy` (nullable string). Shift logs already capture `staffName`;
  point both at the roster via a name picker instead of free text.

**Behaviour / screens:**
- **Branch split everywhere it matters:** revenue mix, finance margin view, and
  the transactions list gain a KL / PJ / All toggle (the data already exists on
  every transaction line's parent).
- Completing a task asks "who are you?" once per session (remembered), stamps
  `completedBy`.
- **Team view (management):** tasks completed and outcomes by staff member;
  shift sign-offs by staff; per-branch open-task ageing.

**Acceptance:** management can compare KL vs PJ revenue/margin for any month,
and see which staff member closed which loops.

## Phase 3 — Loyalty engine: activate the points

**Goal:** turn `pointsBalance` from a manual number into an earn/redeem system
staff can speak to at the counter.

**Data model (additive):**
- `PointsEntry` ledger (customerId, delta, reason enum: `PURCHASE`, `REDEMPTION`,
  `ADJUSTMENT`, `BONUS`; linked transactionId nullable; note; createdAt).
  `Customer.pointsBalance` becomes the cached sum.

**Logic (one config module, like membership):**
- Earn rule: X points per RM (config constant, default 1/RM), granted
  automatically when a transaction links to a customer (StoreHub sync + manual
  link both flow through one hook).
- Redemption: manual action with a note ("redeemed RM20 off"), always
  management-approvable later via the ledger.
- Keep reconciliation against the mirrored StoreHub loyalty number (flag drift,
  never overwrite).

**Screens:** member card on customer detail gains the ledger + "redeem" action;
members page shows points column already — now it's real.

**Acceptance:** a purchase automatically grows the customer's points; staff can
answer "how many points do I have?" and record a redemption, and every point
movement has a ledger row.

## Phase 4 — Lifecycle campaigns: act on what we know

**Goal:** the pet data staff work hard to capture starts generating outreach on
its own — reusing the Task system end to end.

**Behaviour (config-driven cadences, one module):**
- **Pet birthdays:** a `CUSTOM`-typed task (or new `BIRTHDAY` type) spawns N
  days before each pet's birthday (DOB or birthday-month), with the existing
  `petBirthday` WhatsApp template. Consent-aware.
- **New pet parent series:** first purchase for a puppy/kitten → a check-in
  task at +14d ("how's the food going?") and +45d (upsell to subscription).
- **Senior pet care:** senior-pet owners get a twice-yearly wellness nudge.
- All spawn via the daily reconcile (dedup like WINBACK), land in the inbox,
  filter by store, and are measured by Phase 1 outcomes.

**Acceptance:** the inbox fills itself with birthday and lifecycle touches at
the right time, each one tap from a WhatsApp message, and their conversion is
visible in the results panel.

## Phase 5 — Inventory intelligence + data hygiene

**Goal:** protect the numbers everything else reads from, and stop promising
customers stock we don't have.

**Behaviour:**
- **Stock × demand alerts:** when a refill prediction or subscription due date
  approaches and the product's Wix stock is at/below a threshold, spawn a
  management `RESTOCK` task (new type) listing the demand behind it.
- **Matching workbench:** a management screen listing unmatched transaction
  lines (the UNCLASSIFIED gap) grouped by raw name, with one-click "match to
  product" / "create product" — every match immediately improves the finance
  view, refills, and brand rollups.
- **Duplicate customer finder:** candidate pairs (same name + similar phone /
  same email), management merge action that re-links pets, transactions, tasks,
  subscriptions, points.

**Acceptance:** the UNCLASSIFIED slice on the finance view trends to zero, and
no subscription reminder goes out for an item that's out of stock.

## Phase 6 — Daily digest: the one-page morning brief

**Goal:** management opens one thing each morning.

**Behaviour:** a `/today` view (and the eod cron's JSON extended to match):
yesterday's sales by branch vs same day last week, shift sign-offs done/missed,
overdue inbox items by type, new lapses and claims, recurring-revenue delta,
and the single biggest anomaly ("PJ margin dropped 6 points yesterday").
Page first; push (email/WhatsApp) only after Phase 6a of Plan 1 lands.

**Acceptance:** the morning question "how are we doing and what needs me?"
takes one page and no clicking.

---

## Carried over from Plan 1

- **Counter SOP page** — analyzed and mocked (checkbox walkthrough with inline
  lead/hold/inquiry capture). Slots naturally after Phase 2 (staff attribution
  makes its checklist runs attributable too).
- **Phase 6a/6b — live two-store WhatsApp** — unchanged, still gated on the
  Meta/BSP account. Phase 4's campaigns and Phase 6's digest both get stronger
  once it lands (auto-ingest + per-store attribution).

## Build order & rationale

1 → 2 → 3 → 4 → 5 → 6. Outcomes (1) first because it retroactively measures
everything already live and every later phase reports through it. Branch/staff
(2) is near-pure reporting on data that already exists — fast, high visibility.
Loyalty (3) and campaigns (4) are the revenue behaviours, built on 1+2 so their
effect is measurable and attributable. Hygiene (5) hardens the base; the digest
(6) is the bow on top. Per phase: propose migration + screens → confirm →
implement → verify locally → deploy → hand over a test script.
