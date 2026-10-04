# Nibbl AI — Master Requirements vs Current Build: Gap Analysis

**Date:** 2026-10-04
**Author:** Riajul (backend/DevOps maintainer)
**Compared:** the controlling **68-page Master Requirements** (+ Feature Document + Adherence checklist) against the **current backend** (`services/backend`), verified against source.

## Headline
The current backend implements an **earlier, simpler milestone** of Nibbl. The Master is a **substantial redesign/expansion**. The *foundation* is real (OCR, product matching, aliases, wallet/ledger, reservations, basic reviews, payout batches), but several **core mechanics are not built** — and the **campaign model itself differs** from the Master.

> **Scope note:** this repo is **backend + AI only**. The Brand & Admin **dashboards are a separate frontend repo**, so items marked 🖥️ are frontend work this backend repo cannot deliver.
>
> **Legend:** ✅ Built · 🟡 Partial · 🔴 Missing · 🖥️ Frontend (separate repo)

## Two things to tell Nibbl up front
1. **Tag Generator** — the Master says build it as a **"Coming Soon" static page** (functionality removed from scope). So it is **not** a missing feature; it's per-spec.
2. The Adherence Guide's **2–4 week target is aggressive** for this scope — the campaign redesign, Discovery/Ranking, and Review Campaigns are each **multi-week** efforts. Recommend phasing and confirming priority with Nibbl.

---

## Area-by-area (the 16 Master areas)

### 1. Brand Dashboard Home — 🟡 / 🖥️
Analytics endpoints exist (brand overview/campaigns), but not shaped to the Master's exact snapshot definitions (cost-per-result, 25-hour-cycle metrics). Mostly a frontend layout spec.

### 2. Product Library — ✅ mostly
Per-flavor/size Product ID ✅, description for AI questions ✅, aliases ✅. Admin-managed category taxonomy 🟡; delete-requires-"DELETE", ratings→filtered reviews are 🖥️.

### 3. Rebate Campaigns — 🔴 major redesign
| Master requirement | Status |
|---|---|
| **25-Hour Claim Capacity** (claims/cycle, pause, 25h rolling reset) | 🔴 — code has `daily_budget` ($) only |
| **Offer types** Free / BOGO Free / B1G1-50% / Buy X Get $Y with *locked* reward math | 🔴 — code uses allocation-% reward tiers |
| Tier allocation 100% guardrail | ✅ (but a different model) |
| **Nibbl approval workflow** (Draft→Submit→Review→Approve/Changes-Requested; rereview keeps old version live) | 🔴 — statuses are only draft/active/paused/completed/archived |
| Reservation Rule Snapshot (lock terms at claim) | 🟡 |
| Reserved reward funding (reserve max, return difference) | 🟡 — Holds exist |
| Retailer Availability / Featured / Receipt Eligibility (Any vs Required) | 🔴 |
| Meta Pixel per campaign | 🔴 |
| Min-purchase in units, BOGO flag | ✅ |

### 4. Discovery & Campaign Lifecycle — 🔴 Missing (largest feature)
Location gate, **Discovery Geography** (Nationwide/States/ZIP+radius) as eligibility gate, **CVR ranking** (Base CVR × Store Match × Brand Interest), "Going Fast", QR/direct-URL geography bypass, campaign-level (not brand-wide) suppression. **None implemented.**

### 5. Shopper Claim & Receipt Flow — 🟡 Partial
Claim→reserve→upload→validate ✅ (basic). Missing: two-checkbox **consent** (Nibbl + Brand email/SMS), active-claim-slot display ("3 of 5"), 7-day deadline from confirm, richer **duplicate fingerprint** (store/register/txn#) + **per-line quantity allocation**, full restriction pop-up set, reminder schedule (48h/12h).

### 6. Redemptions & Manual Review — 🟡 Partial
Queue + approve/decline + add-alias ✅. Missing: select-receipt-lines + confirm-product-mapping, system-calculated reward (brand can't override), **standardized rejection reasons**, **7-day auto-approve at MAX reward** (verified missing), status tabs/export distinguishing auto vs manual.

### 7. Review Campaigns & Product Reviews — 🔴 Mostly missing
Only a basic one-per-product AI review exists. Missing: dedicated **Review Campaign** (daily budget, eligible products, brand questions rotated into AI chat), **AI 5-question chat flow**, **review reservation** ($1 / 30-day), **moderation** (4–5★ auto-publish / 1–3★ held 7 days), **90-day per-product cooldown**, **max 5 opportunities/receipt**, product-ID lifetime ratings + AI summaries.

### 8. Brand Analytics — 🟡 Partial
Overview/campaign/product analytics exist, but not to Master definitions (Total Brand Cost from actual wallet txns, view→claim rate, 25-hour-cycle performance states: Exhausted Early / On Pace / Behind / Building Data).

### 9. Customers — 🟡 Partial
Brand customers + plan-based data gating ✅. Missing: consent status/date tracking, opt-out handling (keep operational history, exclude from exports), site-vs-brand activity split, Klaviyo/Postscript/Shopify "coming soon".

### 10. Brand Wallet — 🟡 Partial
Ledger + Holds (reserved) + brand escrow + pause-on-$0 ✅. Missing: **Promotional Credits** as a tracked balance, **Stripe auto-refill** (trigger at 25% of 7-day need), weekly statements + detailed ledger export, 7-day funding estimate.

### 11. Plans — 🟡 Partial
Plan tiers + fees + data-access + Subscription model ✅. Missing: **per-plan active-campaign limit enforcement (1/3/10)** (not checked in `create_campaign`), **plan-change-on-renewal** flow + downgrade handling + self-serve switching (admin-only today).

### 12. Settings & Tag Generator — 🟡 / 🖥️
Tag Generator → **Coming-Soon static page per spec** (existing backend endpoint no longer required). Missing: team roles (Owner/Admin/Viewer), per-member notification prefs (email/SMS), Meta Pixel ID validation, passwordless/session security view.

### 13. Brand Onboarding — 🟡 / 🖥️
Brand application + approval ✅. Missing: guided plan-select → company info → email verify → checkout/payment → wallet funding (mostly 🖥️ + Stripe).

### 14. Shopper Wallet, Withdrawals & Referrals — 🟡 Partial
Wallet, withdrawals (PayPal/Venmo), payout methods, referrals ✅. Missing: SMS-verify withdrawal, duplicate-payout-account review flow, payout-method-change review hold, detailed referral qualification steps.

### 15. Admin — Dashboard / Withdrawals / Brands / Campaign Approvals / Promo Codes — 🟡 Partial
Built: revenue views, **withdrawal batch processing** (`PayoutBatch`, statuses pending/processing/paid/flagged/rejected, manual-review flag) ✅, brand suspend, promo **credit**. Missing: **Campaign Approval queue** (no approval workflow), **Promo Codes** (reusable codes vs direct credit), brand-as-superuser access logging, configurable withdrawal thresholds ($25 / $100 rolling).

### 16. Admin — Shoppers / Suspensions / Referrals / Analytics / Receipt Discovery / Settings — 🟡 Partial
Built: user list/suspend/reactivate, fraud flags, audit logs, announcements, role stats. Missing: per-brand + global suspension logic, referral flag review, **Receipt Brand Discovery** (unpartnered-brand leads), revenue analytics to Master shape, **Admin Settings** (withdrawal thresholds, referral toggles, **Discovery Ranking** config).

---

## Cross-cutting fraud/abuse (Feature Doc §2.7)
Duplicate + line-item + velocity + manual review ✅ · **device/IP/browser checks 🔴** · PayPal/Venmo one-account-per-user 🟡 · active-claim limits 🟡 · 30-day premium cooldown ✅.

---

## Suggested priority roadmap
1. **Quick backend wins:** per-plan campaign-limit enforcement · 7-day auto-approve job · standardized rejection reasons · promo-credit balance · Tag Generator → Coming-Soon.
2. **Core redesign (big):** campaign model → **25-Hour Claim Capacity + offer types** with locked reward math · **Nibbl approval workflow**.
3. **Discovery/Ranking (big):** geography eligibility gate · CVR × store-match × brand-interest · retailer availability/eligibility · admin ranking config.
4. **Review Campaigns (big):** dedicated campaign · AI chat · reservation · moderation · limits.
5. **Wallet/Billing:** Stripe auto-refill · statements · plan-change-on-renewal.
6. **Admin ops:** campaign approval queue · promo codes · suspensions · receipt brand discovery · configurable thresholds.

*Items 2–4 are multi-week each. The full Master is realistically well beyond 2–4 weeks with the current team — phasing and priority confirmation with Nibbl is strongly recommended.*

---

*Every status is traceable to the backend source (verified 2026-10-04). If the team believes something marked 🔴/🟡 is built, point me at the code and I'll re-verify. This is an audit — no code was changed.*
