# Nibbl AI — Master Requirements Checklist

**Living tracker.** We tick items off as each requirement is completed to the Master spec.

**Status key:** `[x]` ✅ Done (meets spec) · `[ ]` 🟡 Partial (exists, not to spec) · `[ ]` ⬜ Not started
**Scope note:** AI chat/OCR = Sakibur · mobile app UI = separate app dev · everything else (backend + brand/admin/website) = us.
**Last updated:** 2026-10-08

---

## Brand Dashboard Home
- [ ] 🟡 **1. Dashboard snapshots & campaign performance table** — analytics exist; not to 25-hour-cycle states (Exhausted Early / On Pace / Behind / Building Data)

## Product Library
- [x] ✅ **2. Product records & identity** — per-flavor Product ID + aliases
- [x] ✅ **3. Delete-product safeguard & ratings link** — "type DELETE" confirmation + history preserved (backend archive); clickable product rating (new `avg_rating`/`review_count` on product API) opens Review Management filtered to that product

## Rebate Campaigns
- [ ] ⬜ **4. 25-Hour Claim Capacity** — currently $ daily_budget; needs redesign
- [ ] ⬜ **5. Offer types w/ locked reward math** — Free / BOGO Free / B1G1-50% / Buy X Get $Y
- [ ] 🟡 **6. Tier allocation must total 100%** — built in current model; changes with offer types
- [ ] ⬜ **7. Nibbl campaign approval workflow** — Draft→Submit→Review→Approve/Changes
- [ ] 🟡 **8. Reservation rule snapshot** — partial
- [ ] 🟡 **9. Reserved reward funding** — Holds exist; reserve-max/return-difference partial
- [ ] ⬜ **10. Retailer availability, featured retailers, receipt eligibility**
- [ ] ⬜ **11. Meta Pixel tracking per campaign**
- [x] ✅ **12. Minimum purchase in units + BOGO flag**

## Discovery & Campaign Lifecycle
- [ ] ⬜ **13. Location gate & discovery geography** — Nationwide / States / ZIP+radius
- [ ] ⬜ **14. Ranking engine (CVR)** — Base CVR × Store Match × Brand Interest
- [ ] 🟡 **15. Direct entry (QR, Meta ad, URL)** — QR/URL access exist; geography bypass N/A until #13
- [ ] ⬜ **16. Campaign-level suppression (not brand-wide)**

## Shopper Claim & Receipt Flow
- [ ] ⬜ **17. Consent capture** — two checkboxes (Nibbl + Brand email/SMS)
- [x] ✅ **18. Active claim slots** — per-shopper hard cap (`ACTIVE_CLAIM_SLOTS`, default 5) enforced on claim; `GET /reservations/slots/` returns used/limit/available for the "3 of 5" display (app/website consume it)
- [ ] 🟡 **19. Receipt validation / duplicate fingerprint / quantity allocation** — basic dup; richer fingerprint (store/register/txn#) + per-line qty missing
- [x] ✅ **20. Reminder schedule (48h / 12h before expiry)** — fires at 48h and 12h before the reservation's exact deadline (each once, never extends it)
- [ ] 🟡 **21. Manual-review decisioning** — queue + approve/decline; select-lines / system-calculated reward / standardized reasons missing
- [ ] ⬜ **22. Seven-day automatic approval** — at max reward (cron scheduler ready; job not built)

## Review Campaigns & Product Reviews
- [ ] ⬜ **23. Dedicated review campaign**
- [ ] ⬜ **24. AI chat review flow** — 5 adaptive Qs + rotating brand Q *(AI = Sakibur; backend scaffolding ours)*
- [ ] ⬜ **25. Review rules engine** — $1 / 30-day / 90-day cooldown / max 5 per receipt
- [ ] ⬜ **26. Review moderation** — 4–5★ auto-publish / 1–3★ held 7 days
- [ ] 🟡 **27. Product reviews display & ratings** — numeric avg + count only; star distribution / AI summary / brand responses missing

## Brand Analytics
- [ ] 🟡 **28. Analytics to the specified definitions** — overview exists; cost-per-result / view→claim / 25-hour states missing

## Customers
- [ ] 🟡 **29. Customer directory & consent handling** — directory + plan-based gating ✓; **plan-gated CSV export ✓** (PII columns only for Pro/Scale); consent status / opt-in-out tracking still missing

## Brand Wallet
- [ ] 🟡 **30. Balances (available, reserved, promotional)** — available/reserved ✓; promotional balance now tracked separately (`promotional`/`reward_available` on wallet API, shown on brand promo card); full three-way breakdown on the main balance card still pending
- [x] ✅ **31. Automatic refill (Stripe)** — 25% of 7-day estimate, recommended amount, in-app failure notification *(done this engagement)*
- [ ] 🟡 **32. Statements & ledger export** — statement exists; **detailed ledger CSV export ✓** (brand wallet, `GET /brands/<id>/wallet/transactions/export/` + Export button on the ledger tab); recurring weekly statements still missing

## Plans
- [x] ✅ **33. Plan definitions & data access** — Starter/Pro/Scale, fees, data-access tiers (enforced)
- [x] ✅ **34. Active-campaign limit enforcement** — 1 / 3 / 10 enforced on activation (pausing frees a slot)
- [ ] 🟡 **35. Plan changes** — admin change-plan ✓; self-serve / on-renewal / downgrade missing

## Settings & Tag Generator
- [ ] 🟡 **36. Settings** — roles (no Viewer), per-member notif prefs, Meta Pixel ID validation, session security
- [x] ✅ **37. Tag Generator** — "Coming Soon" static page in brand dashboard (per spec; no backend)

## Brand Onboarding
- [ ] 🟡 **38. Guided onboarding** — application + approval ✓; guided plan→checkout→wallet-funding missing

## Shopper Wallet, Withdrawals & Referrals
- [ ] 🟡 **39. Wallet & withdrawals** — wallet + withdrawals ✓; **SMS-verified withdrawal: backend + website done, pending Twilio activation** *(this engagement)*
- [ ] 🟡 **40. Referrals** — invite/code ✓; full qualification flow (join→claim→redeem→payout→withdraw) missing
- [x] ✅ **41. Payout-account safeguards** — one PayPal/Venmo per user ✓; first method auto-approved, later changes held for admin review (withdrawals blocked until approved); duplicate across users raises a fraud flag; admin review queue UI (approve/reject)

## Admin — Dashboard, Withdrawals, Brands, Approvals, Promo
- [ ] 🟡 **42. Admin dashboard & revenue** — views exist; not to Master shape
- [x] ✅ **43. Withdrawal batch processing** — batches + approve/reject/mark-paid
- [ ] ⬜ **44. Campaign approval queue**
- [x] ✅ **45. Promo codes** — reusable admin-created codes (amount, validity dates, usage limits, once-per-brand) redeemed by brands for *promotional* credit; promo money covers fees/subscription (promo-first) but never shopper rewards (wallet real/promo split enforced); admin create/list UI + brand redeem UI
- [ ] 🟡 **46. Shopper management & suspensions** — user suspend ✓; per-brand + repeated-suspension alerts missing
- [ ] ⬜ **47. Referral management / flag review**
- [ ] ⬜ **48. Receipt brand discovery** — unpartnered-brand leads
- [ ] 🟡 **49. Revenue analytics** — partial; subscription/rebate/review-fee breakdowns missing
- [ ] ⬜ **50. Admin settings** — withdrawal thresholds ($25/$100), referral toggles, Discovery Ranking config

## Cross-cutting
- [ ] 🟡 **51. Fraud & abuse controls** — duplicate / velocity / manual ✓; device / IP / browser checks missing

---

## Progress
**Done to spec (12):** #2, #3, #12, #18, #20, #31, #33, #34, #37, #41, #43, #45.
**This engagement so far:** Stripe wallet funding + auto-refill to spec (#31), SMS-verified withdrawal backend + website (#39, pending Twilio activation).

## Foundational work (supports the above, not separate Master items)
- Security fix — blocked public self-registration as platform admin
- Scheduled jobs (cron, now in Ansible) — enables #20, #22, #31, subscriptions
- Prod access via SSM, Stripe configured on prod (test keys), CI build optimization, backend health-check fix

## On hold (waiting on others)
- **Turn Twilio on in prod** — activates #39 SMS verification (hold until web + mobile ready — user will say go)
- **Mobile withdrawal verify UI** — app dev (API doc handed off)
- **Stripe go-live keys** — Alex (webhook secret)
- **Push/FCM** — Alex (Firebase service account)
