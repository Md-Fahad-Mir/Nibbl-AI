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
- [x] ✅ **11. Meta Pixel tracking per campaign** — Settings → Tracking: one Meta Pixel ID per brand, validated (15–16 digits; scripts/custom code rejected), removable; Google Tag + TikTok Pixel shown as Coming Soon; per-campaign on/off switch on the campaign page (needs a validated pixel); shopper website fires Campaign View, Claim and Approved Redemption to the brand's pixel only (`trackSingleCustom`, no auto page/button tracking). *Tracking limitations: validation is a format check (confirming with Meta needs a Meta token, not in launch scope); browser-only, no CAPI — Approved Redemption fires when the shopper next opens their wallet (within 7 days, once per redemption); ad blockers can block events; mobile app sends none*
- [x] ✅ **12. Minimum purchase in units + BOGO flag**

## Discovery & Campaign Lifecycle
- [x] ✅ **13. Location gate & discovery geography** — campaign geography (Nationwide / Selected States / ZIP + 5–100 mi radius, multiple areas) in the builder + approvals; shopper location (ZIP or device position → nearest ZIP, saved); feed shows only geographically eligible campaigns; website "Find deals near you" gate. US ZIP data: GeoNames (CC BY 4.0)
- [x] ✅ **14. Ranking engine (CVR)** — Base CVR (30-day redemptions ÷ views with admin pseudo-data prior) × Store Match (verified receipt at one of the campaign's retailers) × Brand Interest (viewed/claimed/redeemed with the brand in 30 days)
- [x] ✅ **15. Direct entry (QR, Meta ad, URL)** — campaign URL/QR open the deal without location; bypasses geography only (status, claims, cooldown, capacity still apply)
- [x] ✅ **16. Campaign-level suppression (not brand-wide)** — discovery hides only the campaign the shopper has an active claim on or is in cooldown for; other campaigns from the same brand still appear

## Shopper Claim & Receipt Flow
- [x] ✅ **17. Consent capture** — two separate checkboxes at claim (Nibbl email+SMS, Brand email+SMS), **both required** to claim (Master "Reserve Offer"; "Required consent" pop-up, API code `consent_required`); snapshot on the reservation + per-user Nibbl / per-brand `MarketingConsent` with grant date; website claim screen has the boxes; app dev guide updated
- [x] ✅ **18. Active claim slots** — per-shopper hard cap (`ACTIVE_CLAIM_SLOTS`, default 5) enforced on claim; `GET /reservations/slots/` returns used/limit/available for the "3 of 5" display (app/website consume it)
- [x] ✅ **19. Receipt validation / duplicate fingerprint / quantity allocation** — physical-receipt identity (merchant + date + time; different transaction no. or register = different receipt; total/misreads never make a receipt "new"), one shopper account per receipt, per-unit allocation (qty 2 funds two claims, never a unit twice; race-safe), rejection releases units, manual-review line selection re-allocates, existing receipts backfilled
- [x] ✅ **20. Reminder schedule (48h / 12h before expiry)** — fires at 48h and 12h before the reservation's exact deadline (each once, never extends it)
- [x] ✅ **21. Manual-review decisioning** — locked claim terms, full receipt viewer (zoom/rotate/download), select lines + correct qty/price (audit-logged), confirm product mapping, optional alias (unchecked; rechecks pending claims), Nibbl-calculated reward (no override), 8 standardized rejection reasons
- [x] ✅ **22. Seven-day automatic approval** — at max reward, labelled "Automatically Approved — Review Deadline Passed", no alias; countdown + warning in the brand queue; claims under review no longer expire

## Review Campaigns & Product Reviews
- [x] ✅ **23. Dedicated review campaign** — separate from rebates: name, dates, eligible products, daily review opportunities, product cooldown (0/30/60/90 days or one time), brand question pool with "Suggest questions"; locked rules ($1, 30 days, cost = $1 + plan review fee); draft → activate / pause / archive. Brand dashboard builder + campaign page. *Campaign image upload not built (field exists)*
- [x] ✅ **24. AI chat review flow** — conversation from the verified receipt: 4 AI product questions + rotated brand question + "buy again / recommend"; AI-written draft the shopper edits, regenerates, rates and confirms; first name + last initial shown. Website chat built. *Adaptive follow-up questions wait on Sakibur's endpoint (docs/AI_REVIEW_ENDPOINTS_SPEC.md); fixed questions until then*
- [x] ✅ **25. Review rules engine** — $1 paid on submit for every rating; opportunity only from an already-verified rebate receipt, max 5 per receipt, quantity never duplicates; 30-day expiry releases the reserve; product cooldown; daily cap; $1 + fee reserved per opportunity
- [x] ✅ **26. Review moderation** — 4–5★ publish immediately; 1–3★ held 7 days for a public brand response or a flag (reason required); flagged reviews wait in the admin "Flagged Reviews" queue (remove / keep); Review Management with filters, Q&A, receipt, customer email and CSV export (disclosure on every row)
- [x] ✅ **27. Product reviews display & ratings** — published-only ratings; star distribution, recommendation rate, sort (newest / highest / lowest / helpful), helpful votes, verified-purchase + reward disclosure, brand responses; shown on the website offer page. *AI summary waits on Sakibur's endpoint (null until then)*

## Brand Analytics
- [x] ✅ **28. Analytics to the specified definitions** — Cost & Results from actual wallet debits (rewards + fees, no subscriptions); Customer & Conversion (rebate views → claims, new vs returning); Campaign Performance from completed 25-hour cycles: Exhausted Early (<12 h, raise limit 25%) / On Pace / Behind / Building Data (<7 cycles)

## Customers
- [x] ✅ **29. Customer directory & consent handling** — brand-scoped consent badge (Opted In / Opted Out / none) with date, source and withdrawal date; shoppers can opt out (website profile + API) and keep their history; download = currently opted-in customers only (full name, email, phone, consent status/date, brand activity, last activity; plan-gated PII); summary (opted-in, open claims, active cooldowns, brand conversion); search + filters (open claim, cooldown, completed rebate, suspended, inactive). *Klaviyo/Postscript/Shopify 'coming soon' cards not built*

## Brand Wallet
- [x] ✅ **30. Balances (available, reserved, promotional)** — wallet page shows Available Funds (real money for new claims; promo excluded), Reserved Funds (split rebates / reviews) and Promotional Credits (pays fees + plan charges, never rewards), each with its Master definition; API adds `reserved_rebates` / `reserved_reviews`
- [x] ✅ **31. Automatic refill (Stripe)** — 25% of 7-day estimate, recommended amount, in-app failure notification *(done this engagement)*
- [x] ✅ **32. Statements & ledger export** — Weekly Statements on the Wallet page: one row per week (rebate rewards, review rewards, fees, plan charges, credits applied, total cash spent = cost after promo credits; deposits/refunds excluded), each week downloadable as a CSV (summary + that week's ledger); detailed ledger CSV for a chosen date range incl. reward reservations and released reservations

## Plans
- [x] ✅ **33. Plan definitions & data access** — Starter/Pro/Scale, fees, data-access tiers (enforced)
- [x] ✅ **34. Active-campaign limit enforcement** — 1 / 3 / 10 enforced on activation (pausing frees a slot)
- [x] ✅ **35. Plan changes** — brand Plans page: current plan + price, next renewal, active campaigns used, 30-day Nibbl spend, billing history; recommendation (monthly spend + campaign capacity); plan options/comparison; self-serve change scheduled for the next renewal (current pricing/access until then), cancellable; downgrade over the limit makes the brand choose which campaigns stay active (others pause at renewal); renewal charged at the new price; admin change-plan stays immediate. Master pricing applied (Starter $39 / Pro $199 / Scale $999 every 30 days; review $5 / $4 / $3 incl. the $1 reward); renewals every 30 days from the subscription date

## Settings & Tag Generator
- [x] ✅ **36. Settings** — Brand Profile: name, website, support email, **default time zone** (applied to dashboard dates). Team & Permissions: **Owner** (everything incl. billing, plans, wallet funding, team), **Admin** (campaigns, customers, tracking, reports), **Viewer** (read-only; stored as role `member`); only the Owner invites/removes members. Notifications: each member's own Email + SMS toggle per brand notification (campaign approval updates, receipts waiting for review, low-rating reviews, refill failed); in-app always on. Tracking: Meta Pixel ID validation (#11). Security: sign-in method, passwordless status (off), most recent sign-in, active sessions (device, IP, last active), **sign out other sessions** (revokes those tokens immediately). Owner-only account-closure note (contact Nibbl Support). *SMS toggles are stored; sending waits on Klaviyo. Sessions list devices signed in after this release*
- [x] ✅ **37. Tag Generator** — "Coming Soon" static page in brand dashboard (per spec; no backend)

## Brand Onboarding
- [x] ✅ **38. Guided onboarding** — self-serve (no admin approval): register with plan choice + company info → verify work email → checkout (plan, promo code, card payment of the first 30 days) activates the brand immediately via the Stripe webhook ($0 due activates without a card) → dashboard "Get ready to launch": first growth goal (new customers / verified reviews), add products, create campaign, fund wallet, go live. Admin approval stays as a manual override. Work email verified through a one-time secure link. *Stripe webhook must be configured for card checkout*

## Shopper Wallet, Withdrawals & Referrals
- [x] ✅ **39. Wallet & withdrawals** — wallet + withdrawals ✓; **SMS-verified withdrawals live on prod** (Twilio Verify): phone add/verify (Profile + inline at withdrawal, any country, 48h pause on phone change, admin phone reset)
- [x] ✅ **40. Referrals** — reward earned only after join (referral link) → claim → approved redemption → payout method connected → successful withdrawal (no more pay-at-signup); general link `?ref=` and specific deal link `&deal=`; shopper progress tracker (5 steps, "being reviewed" without internal reasons, rejection reason shown); paid to the referrer's wallet, then normal withdrawal rules. Website: copy link, per-friend progress, "Share this deal". *Mobile app: progress + deal links per the API doc*
- [x] ✅ **41. Payout-account safeguards** — one PayPal/Venmo per user ✓; first method auto-approved, later changes held for admin review (withdrawals blocked until approved); duplicate across users raises a fraud flag; admin review queue UI (approve/reject)

## Admin — Dashboard, Withdrawals, Brands, Approvals, Promo
- [x] ✅ **42. Admin dashboard & revenue** — Dashboard Overview by date range (7 / 30 / 90 days / 12 months): Revenue Summary, Needs Attention (withdrawals needing review, campaign approvals, failed payouts, suspended shoppers, brand suspensions, flagged reviews — each links to its queue), Brand Revenue (per brand; filter by status / plan; lowest revenue first), Brand-Funded Rewards shown separately. *Failed payouts show "—" until PayPal payout results are imported; brands have no category field yet, so the filter is status / plan*
- [x] ✅ **43. Withdrawal batch processing** — batches + approve/reject/mark-paid
- [x] ✅ **44. Campaign approval queue** — admin Campaign Approvals page: new campaigns and revisions kept separate, essential terms + proposed changes, approve / request changes / reject with comment
- [x] ✅ **45. Promo codes** — reusable admin-created codes (amount, validity dates, usage limits, once-per-brand) redeemed by brands for *promotional* credit; promo money covers fees/subscription (promo-first) but never shopper rewards (wallet real/promo split enforced); admin create/list UI + brand redeem UI
- [x] ✅ **46. Shopper management & suspensions** — global suspend ✓; **per-brand suspension** (brand Customers → Suspend/Reactivate, blocks claims on that brand only; anonymized plans act by `cust_` ref); **repeated-suspension fraud alert** (`REPEATED_SUSPENSION_ALERT`, default 3); shopper wallet adjustments now **require a reason** + ledger entry
- [x] ✅ **47. Referral management / flag review** — admin Referrals: summary (in progress, qualified, flagged, paid), flagged kept separate, referrer + new shopper + steps + reward status, clear flag reason; approve (pays), reject (customer-facing reason required), suspend the new shopper or the referrer. Referral Flag Rules in Admin Settings (same device / same network / fraud signals — each switchable)
- [x] ✅ **48. Receipt brand discovery** — admin "Brand Discovery": unpartnered brands found on verified receipts (lines not matched to a partner product; existing partners excluded). Summary (unpartnered brands, verified receipts, participating retailers); filters (date, brand, category, retailer, state); leads with brand, product text, retailer, state, unique shoppers, receipt volume, repeat purchasers — no shopper identities; selected-brand insight with outreach message; CSV export. *OCR returns no brand, so the brand is detected from the product text's leading word; admin can rename/merge or hide (e.g. store brands). State = the shopper's saved discovery location*
- [x] ✅ **49. Revenue analytics** — `GET /admin/analytics/revenue/`: subscription revenue, rebate fees, review fees (from brand wallet debits), promo credits applied + cash revenue; shopper rewards excluded from revenue and reported as brand-funded rewards; per-brand breakdown; monthly Revenue Trend by source. *Refunds and payment-processing costs (Stripe fees) aren't recorded in the ledger yet, so net revenue shows credits only*
- [x] ✅ **50. Admin settings** — withdrawal-review thresholds + referral toggle; Discovery Ranking (pseudo-data views/redemptions, Store Match ×, Brand Interest ×) and the configurable "Going fast" threshold

## Cross-cutting
- [x] ✅ **51. Fraud & abuse controls** — duplicate / velocity / manual ✓; device / IP / browser recorded at signup, login, claim, receipt upload, payout method and withdrawal (device id hashed); admin rules: max accounts per device (90 days) and per network (24 h), switchable; matches send receipts to manual review (fraud flag "Shared device or network") and withdrawals to Manual Review with the admin-only reason; admin user detail shows linked accounts + risk. *Mobile app must send `X-Device-Id`*

---

## Progress
**Done to spec (51):** #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16, #17, #18, #19, #20, #21, #22, #23, #24, #25, #26, #27, #28, #29, #30, #31, #32, #33, #34, #35, #36, #37, #38, #39, #40, #41, #42, #43, #44, #45, #46, #47, #48, #49, #50, #51.
**This engagement so far:** Stripe wallet funding + auto-refill to spec (#31), SMS-verified withdrawal backend + website (#39, pending Twilio activation).

## Foundational work (supports the above, not separate Master items)
- Security fix — blocked public self-registration as platform admin
- Scheduled jobs (cron, now in Ansible) — enables #20, #22, #31, subscriptions
- Prod access via SSM, Stripe configured on prod (test keys), CI build optimization, backend health-check fix

## On hold (waiting on others)
- **Twilio compliance profile** — Twilio is on in prod; sending is blocked (error 21608) until Alex completes the Primary Compliance Profile
- **Mobile withdrawal verify UI** — app dev (API doc handed off)
- **Stripe go-live keys** — Alex sent the live keys + webhook secret (10/7 doc); see below
- **Push/FCM** — Alex can't issue a service-account key; needs Workload Identity Federation (see below)

## Client integration items (credentials doc, received 2026-10-10) — to do when we pick them up
Secrets are in the client's doc only; they go in the prod env file, never in the repo.
- **Stripe → Live** — prod still on `sk_test_`. Swap `STRIPE_SECRET_KEY` (live restricted key), `STRIPE_WEBHOOK_SECRET` (live whsec), brand app `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Live webhook already created at `/api/v1/billing/webhooks/stripe/`. Code: recreate Stripe customers / drop saved test cards that don't exist in live (StripeCustomer, AutoRefill.payment_method). We act on `payment_intent.succeeded`, safely ignore the other events. Product/Price IDs not needed (plans charged from the wallet). Test cards stop working after the switch — decide timing.
- **AWS SES** — replace Gmail SMTP (`fahad1001mir@gmail.com`) with SES us-west-1, sender `@joinnibbl.com` (domain + DKIM verified), NibblDeployment IAM credentials. Must add bounce/complaint handling (SNS → suppression). SES still in sandbox (verified recipients only) until AWS approves.
- **Twilio Verify** — prod already uses the client's service. New rules: a verified phone is locked (no self-service change in profile/wallet/settings); changes only via admin with re-verification; keep verification status + phone-change history.
- **ZIP dataset** — client asks for Census ZCTA Gazetteer (+ periodic refresh). We use GeoNames (has city + state; state is needed for state geography). ZCTA has no city/state → would need a ZIP→state crosswalk. Recommend keeping GeoNames; confirm with client.
- **Push (FCM/APNs)** — push is a stub today (`Apps/notifications/push.py`). Client will configure Google Workload Identity Federation; reply to client: backend runs on **EC2**, role `arn:aws:iam::205960220667:role/nibblai-production-ec2-role`. Then build FCM HTTP v1 sending. APNs `.p8` is already in Firebase — not needed on our server. `google-services.json` / `GoogleService-Info.plist` (package/bundle `com.joinnibbl.app`) go to the mobile app dev.
- **Meta Pixel** — scope confirmed for #11 (brand Pixel ID + validate, per-campaign toggle, Campaign View / Claim / Approved Redemption, browser pixel only, no custom scripts, no CAPI / Advanced Matching).
