# Nibbl AI — Master Requirements Checklist

**Living tracker.** We tick items off as each requirement is completed to the Master spec.

**Status key:** `[x]` ✅ Done (meets spec) · `[ ]` 🟡 Partial (exists, not to spec) · `[ ]` ⬜ Not started
**Scope note:** AI chat/OCR = Sakibur · mobile app UI = separate app dev · everything else (backend + brand/admin/website) = us.
**Last updated:** 2026-10-08

---

## Brand Dashboard Home
- [x] ✅ **1. Dashboard snapshots & campaign performance table** — brand name in welcome; header "Available Funds" links to Wallet; last-30-day snapshots without charts/badges (Rebates: claims, redemptions, redemption rate, Total Brand Cost + cost per redemption; Reviews: invitations, completed, completion rate, Total Brand Cost + cost per review); "Campaign Performance" table incl. ended campaigns with claims/redemptions results. *Tracking note: review invitations = verified purchases eligible for a review until review campaigns (#23)*

## Product Library
- [x] ✅ **2. Product records & identity** — per-flavor Product ID + aliases
- [x] ✅ **3. Delete-product safeguard & ratings link** — "type DELETE" confirmation + history preserved (backend archive); clickable product rating (new `avg_rating`/`review_count` on product API) opens Review Management filtered to that product

## Rebate Campaigns
- [x] ✅ **4. 25-Hour Claim Capacity** — desired ÷ rate (rounded up), cycles from activation (or start date), consumed slots never return; builder shows the live calculation, card + detail page show "Current cycle claims X of Y"
- [x] ✅ **5. Offer types w/ locked reward math** — Free / BOGO Free / B1G1-50% / Buy X Get $Y; builder with suggested (editable) wording, locked system-rules summary, live shopper preview
- [x] ✅ **6. Tier allocation must total 100%** — superseded by offer types (Master #5); old tier input still accepted and mapped
- [x] ✅ **7. Nibbl campaign approval workflow** — Save draft / Submit; approve / reject (final) / request changes with comments; revisions keep the approved version live; campaign detail page with status banner, assets, performance, review activity
- [x] ✅ **8. Reservation rule snapshot** — each claim stores its deal terms, products, merchants and cooldown; later edits apply to new claims only
- [x] ✅ **9. Reserved reward funding** — claim reserves the max reward; approval pays the actual reward and returns the difference; cooldown starts at the approved redemption
- [x] ✅ **10. Retailer availability, featured retailers, receipt eligibility** — Nibbl retailer directory (seeded; brands add missing ones, flagged for Nibbl to verify in Django admin), Where to Buy, up to 3 Featured Retailers, Any Retailer / Retailer Required (receipt check + claim snapshot); builder, detail page, admin approvals, shopper website + app guide
- [ ] ⬜ **11. Meta Pixel tracking per campaign**
- [x] ✅ **12. Minimum purchase in units + BOGO flag**

## Discovery & Campaign Lifecycle
- [x] ✅ **13. Location gate & discovery geography** — campaign geography (Nationwide / Selected States / ZIP + 5–100 mi radius, multiple areas) in the builder + approvals; shopper location (ZIP or device position → nearest ZIP, saved); feed shows only geographically eligible campaigns; website "Find deals near you" gate. US ZIP data: GeoNames (CC BY 4.0)
- [x] ✅ **14. Ranking engine (CVR)** — Base CVR (30-day redemptions ÷ views with admin pseudo-data prior) × Store Match (verified receipt at one of the campaign's retailers) × Brand Interest (viewed/claimed/redeemed with the brand in 30 days)
- [x] ✅ **15. Direct entry (QR, Meta ad, URL)** — campaign URL/QR open the deal without location; bypasses geography only (status, claims, cooldown, capacity still apply)
- [x] ✅ **16. Campaign-level suppression (not brand-wide)** — discovery hides only the campaign the shopper has an active claim on or is in cooldown for; other campaigns from the same brand still appear

## Shopper Claim & Receipt Flow
- [x] ✅ **17. Consent capture** — two separate optional checkboxes at claim (Nibbl email+SMS, Brand email+SMS); snapshot on the reservation + per-user Nibbl / per-brand `MarketingConsent` with grant date; website claim screen has the boxes; app dev guide updated
- [x] ✅ **18. Active claim slots** — per-shopper hard cap (`ACTIVE_CLAIM_SLOTS`, default 5) enforced on claim; `GET /reservations/slots/` returns used/limit/available for the "3 of 5" display (app/website consume it)
- [x] ✅ **19. Receipt validation / duplicate fingerprint / quantity allocation** — physical-receipt identity (merchant + date + time; different transaction no. or register = different receipt; total/misreads never make a receipt "new"), one shopper account per receipt, per-unit allocation (qty 2 funds two claims, never a unit twice; race-safe), rejection releases units, manual-review line selection re-allocates, existing receipts backfilled
- [x] ✅ **20. Reminder schedule (48h / 12h before expiry)** — fires at 48h and 12h before the reservation's exact deadline (each once, never extends it)
- [x] ✅ **21. Manual-review decisioning** — locked claim terms, full receipt viewer (zoom/rotate/download), select lines + correct qty/price (audit-logged), confirm product mapping, optional alias (unchecked; rechecks pending claims), Nibbl-calculated reward (no override), 8 standardized rejection reasons
- [x] ✅ **22. Seven-day automatic approval** — at max reward, labelled "Automatically Approved — Review Deadline Passed", no alias; countdown + warning in the brand queue; claims under review no longer expire

## Review Campaigns & Product Reviews
- [ ] ⬜ **23. Dedicated review campaign**
- [ ] ⬜ **24. AI chat review flow** — 5 adaptive Qs + rotating brand Q *(AI = Sakibur; backend scaffolding ours)*
- [ ] ⬜ **25. Review rules engine** — $1 / 30-day / 90-day cooldown / max 5 per receipt
- [ ] ⬜ **26. Review moderation** — 4–5★ auto-publish / 1–3★ held 7 days
- [ ] 🟡 **27. Product reviews display & ratings** — numeric avg + count only; star distribution / AI summary / brand responses missing

## Brand Analytics
- [x] ✅ **28. Analytics to the specified definitions** — Cost & Results from actual wallet debits (rewards + fees, no subscriptions); Customer & Conversion (rebate views → claims, new vs returning); Campaign Performance from completed 25-hour cycles: Exhausted Early (<12 h, raise limit 25%) / On Pace / Behind / Building Data (<7 cycles)

## Customers
- [x] ✅ **29. Customer directory & consent handling** — brand-scoped consent badge (Opted In / Opted Out / none) with date, source and withdrawal date; shoppers can opt out (website profile + API) and keep their history; download = currently opted-in customers only (full name, email, phone, consent status/date, brand activity, last activity; plan-gated PII); summary (opted-in, open claims, active cooldowns, brand conversion); search + filters (open claim, cooldown, completed rebate, suspended, inactive). *Klaviyo/Postscript/Shopify 'coming soon' cards not built*

## Brand Wallet
- [x] ✅ **30. Balances (available, reserved, promotional)** — wallet page shows Available Funds (real money for new claims; promo excluded), Reserved Funds (split rebates / reviews) and Promotional Credits (pays fees + plan charges, never rewards), each with its Master definition; API adds `reserved_rebates` / `reserved_reviews`
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
- [x] ✅ **39. Wallet & withdrawals** — wallet + withdrawals ✓; **SMS-verified withdrawals live on prod** (Twilio Verify): phone add/verify (Profile + inline at withdrawal, any country, 48h pause on phone change, admin phone reset)
- [ ] 🟡 **40. Referrals** — invite/code ✓; full qualification flow (join→claim→redeem→payout→withdraw) missing
- [x] ✅ **41. Payout-account safeguards** — one PayPal/Venmo per user ✓; first method auto-approved, later changes held for admin review (withdrawals blocked until approved); duplicate across users raises a fraud flag; admin review queue UI (approve/reject)

## Admin — Dashboard, Withdrawals, Brands, Approvals, Promo
- [ ] 🟡 **42. Admin dashboard & revenue** — views exist; not to Master shape
- [x] ✅ **43. Withdrawal batch processing** — batches + approve/reject/mark-paid
- [x] ✅ **44. Campaign approval queue** — admin Campaign Approvals page: new campaigns and revisions kept separate, essential terms + proposed changes, approve / request changes / reject with comment
- [x] ✅ **45. Promo codes** — reusable admin-created codes (amount, validity dates, usage limits, once-per-brand) redeemed by brands for *promotional* credit; promo money covers fees/subscription (promo-first) but never shopper rewards (wallet real/promo split enforced); admin create/list UI + brand redeem UI
- [x] ✅ **46. Shopper management & suspensions** — global suspend ✓; **per-brand suspension** (brand Customers → Suspend/Reactivate, blocks claims on that brand only; anonymized plans act by `cust_` ref); **repeated-suspension fraud alert** (`REPEATED_SUSPENSION_ALERT`, default 3); shopper wallet adjustments now **require a reason** + ledger entry
- [ ] ⬜ **47. Referral management / flag review**
- [ ] ⬜ **48. Receipt brand discovery** — unpartnered-brand leads
- [ ] 🟡 **49. Revenue analytics** — partial; subscription/rebate/review-fee breakdowns missing
- [x] ✅ **50. Admin settings** — withdrawal-review thresholds + referral toggle; Discovery Ranking (pseudo-data views/redemptions, Store Match ×, Brand Interest ×) and the configurable "Going fast" threshold

## Cross-cutting
- [ ] 🟡 **51. Fraud & abuse controls** — duplicate / velocity / manual ✓; device / IP / browser checks missing

---

## Progress
**Done to spec (35):** #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #12, #13, #14, #15, #16, #17, #18, #19, #20, #21, #22, #28, #29, #30, #31, #33, #34, #37, #39, #41, #43, #44, #45, #46, #50.
**This engagement so far:** Stripe wallet funding + auto-refill to spec (#31), SMS-verified withdrawal backend + website (#39, pending Twilio activation).

## Foundational work (supports the above, not separate Master items)
- Security fix — blocked public self-registration as platform admin
- Scheduled jobs (cron, now in Ansible) — enables #20, #22, #31, subscriptions
- Prod access via SSM, Stripe configured on prod (test keys), CI build optimization, backend health-check fix

## On hold (waiting on others)
- **Twilio compliance profile** — Twilio is on in prod; sending is blocked (error 21608) until Alex completes the Primary Compliance Profile
- **Mobile withdrawal verify UI** — app dev (API doc handed off)
- **Stripe go-live keys** — Alex (webhook secret)
- **Push/FCM** — Alex (Firebase service account)
