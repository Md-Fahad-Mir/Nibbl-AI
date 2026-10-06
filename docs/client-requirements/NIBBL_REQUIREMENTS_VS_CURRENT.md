# Nibbl AI — Requirements vs Current Implementation

Date: 2026-10-04

Source: the client's Master Requirements (68 pages), Feature Document, and Adherence checklist, compared against the current backend (services/backend), verified against source. Status values are plain: Built, Partial, or Missing. Items that belong to the separate frontend (dashboard) repo are noted as Frontend.

## Brand Dashboard Home

**1. Dashboard snapshots and campaign performance table**
Client wants: Rebate snapshots (Claims, Redemptions, Redemption Rate, Total Brand Cost, Cost per Redemption) and Review snapshots (Review Invitations, Reviews Completed, Completion Rate, Total Brand Cost, Cost per Review); a Campaign Performance table that includes ended campaigns; Available Funds; links to Plans and Wallet.
Currently have: Brand analytics endpoints exist (overview, campaigns, products) but are not shaped to these exact metrics (no cost-per-result, no 25-hour-cycle figures). The dashboard layout itself is Frontend.
Status: Partial (backend); layout is Frontend.

## Product Library

**2. Product records and identity**
Client wants: a separate record per flavor and size with a permanent Product ID; description retained for AI review questions; standardized admin-managed categories; receipt matching via retailer + receipt product text + optional item code, with aliases.
Currently have: Product model with per-flavor/size records and a UUID Product ID; description; tags; ProductAlias for receipt matching. Category taxonomy is basic (tags); a formal admin-managed category list is to be confirmed.
Status: Mostly Built.

**3. Delete-product safeguard and ratings link**
Client wants: typing DELETE to confirm deletion; preserve historical reviews and redemptions; clickable average rating opens Review Management filtered to that product.
Currently have: deleting a product archives it (soft-disable), preserving history — backend. The DELETE-typing confirmation and the ratings link are Frontend.
Status: Partial (backend archive done; UI pieces are Frontend).

## Rebate Campaigns

**4. Campaign budget model — 25-Hour Claim Capacity**
Client wants: campaigns capped by claims per rolling 25-hour cycle (Desired Redemptions divided by Estimated Redemption Rate, rounded up); pause when the cap is reached; reset every 25 hours from activation (not at midnight).
Currently have: campaigns use a daily budget in dollars; there is no 25-hour claim-capacity concept.
Status: Missing (different model in code).

**5. Offer types with locked reward math**
Client wants: Free, BOGO Free, Buy 1 Get 1 50% Off, and Buy X Get $Y Off — each with its own required inputs, locked reward calculation, and suggested shopper wording.
Currently have: reward tiers with allocation percentages (waterfall high-to-low); a BOGO flag exists, but not the four defined offer types or their reward calculations.
Status: Missing (different model in code).

**6. Tier allocation must total 100%**
Client wants: campaign reward allocations must equal 100%.
Currently have: enforced — allocations must sum to exactly 100%, checked when tiers are set and again on activation.
Status: Built (within the current tier model).

**7. Nibbl campaign approval workflow**
Client wants: Draft, then Submit, then Nibbl review, then Approve or Changes Requested; edits to a live campaign require re-review while the currently approved version stays live.
Currently have: campaign statuses are draft, active, paused, completed, archived; the brand activates directly; there is no Nibbl review/approval gate.
Status: Missing.

**8. Reservation rule snapshot**
Client wants: when a shopper reserves, snapshot the offer terms that apply (offer type, reward calculation, eligible products, required quantity, eligible retailers, cooldown, deadline); later edits apply only to new claims.
Currently have: the reservation snapshots the offer type, tier, reward amount, and deadline, but not the eligible products, required quantity, eligible retailers, or cooldown terms.
Status: Partial.

**9. Reserved reward funding**
Client wants: reserve the maximum possible reward when a claim is created; convert to the actual reward on approval; return the unused difference; release the reservation on rejection or expiration.
Currently have: the wallet reserves funds for claims via Holds, with release and capture logic.
Status: Partial.

**10. Retailer availability, featured retailers, and receipt eligibility**
Client wants: select retailers from a directory; up to three Featured Retailers; Any-Retailer vs Retailer-Required receipt eligibility.
Currently have: none of these exist.
Status: Missing.

**11. Meta Pixel tracking per campaign**
Client wants: per-campaign Meta Pixel on/off using a validated Pixel ID; send Campaign View, Claim, and Approved Redemption events.
Currently have: none.
Status: Missing.

**12. Minimum purchase in units and BOGO**
Client wants: minimum purchase defined in units (for example Buy 2); BOGO handled automatically.
Currently have: minimum-purchase-units and a BOGO flag exist.
Status: Built.

## Discovery and Campaign Lifecycle

**13. Location gate and discovery geography**
Client wants: establish the shopper's location or ZIP before showing deals; geographic eligibility (Nationwide, Selected States, or ZIP + radius) as a gate applied before ranking.
Currently have: none; the offer feed is not location-gated and has no geography concept.
Status: Missing.

**14. Ranking engine (CVR)**
Client wants: rank eligible campaigns using Base CVR multiplied by a Store Match boost and a Brand Interest boost; show "Going Fast" when 20% or less of claim capacity remains.
Currently have: none; there is no CVR tracking or ranking.
Status: Missing.

**15. Direct entry (QR, Meta ad, or direct URL)**
Client wants: a QR code, Meta ad, email link, or direct URL opens that specific deal and bypasses discovery geography, while all other rules still apply.
Currently have: campaign URLs and QR tokens resolve an offer; the geography-bypass behavior is not applicable because geography does not exist yet.
Status: Partial (links and QR exist; geography concept absent).

**16. Campaign-level suppression (not brand-wide)**
Client wants: claiming Campaign A hides only Campaign A for that shopper; other campaigns from the same brand remain visible; each campaign keeps its own cooldown.
Currently have: per-campaign cooldown exists (cooldown records and per-campaign cooldown days); a reservation is unique per user and campaign.
Status: Partial (per-campaign cooldown is built; the discovery/ranking context around it is missing).

## Shopper Claim and Receipt Flow

**17. Consent capture**
Client wants: two separate checked consents at reservation — Nibbl email and SMS, and Brand email and SMS — stored separately.
Currently have: terms acceptance at signup; there is no per-reservation Nibbl and Brand email/SMS consent capture.
Status: Missing.

**18. Active claim slots**
Client wants: show the shopper's active-claim slot usage (for example 3 of 5) and limit how many claims can be open at once.
Currently have: one active reservation per user per campaign is enforced, plus a global system-wide cap on total active reservations; there is no per-shopper "N of 5" concurrent-claim limit.
Status: Missing (the per-shopper slot cap; one-per-campaign is enforced).

**19. Receipt validation, duplicate fingerprint, and quantity allocation**
Client wants: capture date/time, retailer, transaction number, item, quantity, net item price, tax, and total; auto-accept, send to manual review, or reject per defined rules; a duplicate fingerprint using retailer, store, date, time, receipt/transaction number, register number, and total; and per-line quantity allocation so the same receipt can serve different claims or units while never crediting the same unit twice.
Currently have: OCR extraction, product matching, and a duplicate hash on merchant/date/time/product; manual-review routing exists; per-line quantity allocation is not implemented and the fingerprint fields are fewer than specified.
Status: Partial.

**20. Reminder schedule**
Client wants: reservation confirmation immediately; receipt reminders 48 hours and 12 hours before expiry; approval, rejection, and expiration notifications.
Currently have: a notifications system exists (push); the exact 48-hour and 12-hour reminder schedule is to be confirmed or built.
Status: Partial.

## Redemptions and Manual Review

**21. Manual-review decisioning**
Client wants: full receipt viewer; select the receipt lines; confirm the product mapping with a separate confirmation; a system-calculated reward the brand cannot override; an optional alias (unchecked by default, with a second confirmation); standardized rejection reasons; full audit logging.
Currently have: a review queue with approve/decline (with reason) and add-alias; the line selection, product mapping, system-calculated reward, and the standardized reason set are partial.
Status: Partial.

**22. Seven-day automatic approval**
Client wants: a receipt in manual review auto-approves exactly seven days after submission at the campaign's maximum reward; the claim slot is released; it is labeled "Automatically Approved — Review Deadline Passed"; no alias is created.
Currently have: not implemented; there is no auto-approval job.
Status: Missing.

## Review Campaigns and Product Reviews

**23. Dedicated review campaign**
Client wants: a separate Review Campaign (name, dates, image); eligible products; a daily review-opportunity budget; optional brand questions rotated into the AI chat; a preview.
Currently have: reviews attach to a product; there is no review-campaign model. A basic AI review exists.
Status: Missing.

**24. AI chat review flow**
Client wants: a chat with five adaptive questions from the product data plus one rotating brand question; capture of recommendation/repurchase and a 1-to-5-star rating; an AI-generated title and body the shopper can edit or regenerate.
Currently have: AI review generation exists (questions and answers produce a review), but not the guided five-question chat or brand-question rotation.
Status: Partial.

**25. Review rules engine**
Client wants: a $1 reward at every rating; a 30-day completion window; a review reservation that reserves the $1 (expires in seven days and is not restored); one rewarded review per product per user every 90 days; a maximum of five review opportunities per receipt; smart prioritization.
Currently have: one review per user per product (a permanent uniqueness rule) and a flat reward; there is no 90-day window, no per-receipt cap, and no review reservation.
Status: Missing / Partial.

**26. Review moderation**
Client wants: 4-5 star reviews publish immediately; 1-3 star reviews are held seven days for brand response or flag; the reward is issued regardless of rating; the brand can flag for removal with a reason; disclosures appear on published reviews.
Currently have: reviews publish immediately; there is no rating-based moderation hold.
Status: Missing.

**27. Product reviews display and ratings**
Client wants: a lifetime rating per Product ID (not per campaign); star distribution; recommendation and buy-again rates; an AI summary; a sortable review list; brand responses.
Currently have: a product review list and an aggregate summary; the AI summary, distribution, helpful votes, and brand responses are to be confirmed.
Status: Partial.

## Brand Analytics

**28. Analytics to the specified definitions**
Client wants: Total Brand Cost computed from actual wallet transactions; view-to-claim conversion; campaign performance based on completed 25-hour cycles with states Exhausted Early, On Pace, Behind, and Building Data.
Currently have: brand analytics (reservations, approvals, redemptions, spend, reviews) exist but not to these exact definitions or cycle-based states.
Status: Partial.

## Customers

**29. Customer directory and consent handling**
Client wants: an opted-in customer directory; a split between brand activity and site-wide activity; consent status and date; opt-out that keeps operational history but excludes the customer from exports; CSV export gated by plan; no cross-brand visibility.
Currently have: brand customers with plan-based data gating, plus customer activity and statement, exist; however there is no marketing consent or opt-in/opt-out tracking (confirmed absent in code), and the brand-vs-site activity split is partial.
Status: Partial (directory and data gating are Built; consent/opt-out tracking is Missing).

## Brand Wallet

**30. Balances (available, reserved, promotional)**
Client wants: Available Funds, Reserved Funds, and Promotional Credits (credits never pay shopper rewards), shown as one simple combined balance.
Currently have: a ledger with Holds (reserved) and an available balance; promotional credit is an ad-hoc admin adjustment rather than a tracked promotional balance.
Status: Partial.

**31. Automatic refill (Stripe)**
Client wants: automatic refill through a saved Stripe method when Available Funds reaches 25% of the seven-day estimate; a fixed charge amount; notify on failure.
Currently have: none; there is no Stripe auto-refill.
Status: Missing.

**32. Statements and ledger export**
Client wants: weekly statements and a downloadable detailed ledger (deposits, reservations, completed rewards, fees, credits, releases, subscriptions, adjustments, refunds).
Currently have: the ledger exists; weekly statements and the export are to be confirmed or built.
Status: Partial.

## Plans

**33. Plan definitions and data access**
Client wants: Starter, Pro, and Scale with prices, rebate fees (20/15/10%), review fees ($5/$4/$3), active-campaign limits (1/3/10), and data-access tiers.
Currently have: plan models with price, fee, review fee, and data-access level; data-access gating is enforced; monthly subscription billing is implemented via a scheduled charge command.
Status: Partial (definitions, gating, and subscription billing done; campaign limits not enforced — see item 34).

**34. Active-campaign limit enforcement**
Client wants: enforce the 1, 3, and 10 active rebate-campaign limits per plan.
Currently have: there is no limit field or check; campaign creation does not enforce a cap.
Status: Missing.

**35. Plan changes**
Client wants: changes take effect on the next 30-day renewal; a downgrade requires choosing which campaigns remain active; self-serve switching; the ability to cancel a scheduled change.
Currently have: an admin can change a brand's plan; there is no brand self-serve switching or renewal-scheduled change.
Status: Partial.

## Settings and Tag Generator

**36. Settings (team roles, notifications, pixel, security)**
Client wants: team roles (Owner, Admin, Viewer); per-member email and SMS notification preferences; Meta Pixel ID validation; a passwordless/session security view.
Currently have: brand membership roles (owner, member) exist; the Owner/Admin/Viewer set, per-member notification preferences, pixel validation, and the session view are missing or partial.
Status: Partial.

**37. Tag Generator**
Client wants: a static "Coming Soon" page only — the functionality was removed from scope.
Currently have: a working tag-generate endpoint exists (more than required); the dashboard should simply show a Coming Soon page.
Status: Per spec, only a Coming Soon page is needed (no backend required).

## Brand Onboarding

**38. Guided onboarding**
Client wants: brand introduction, plan selection, company information, work-email verification, checkout/payment, and wallet funding before launch.
Currently have: brand application and admin approval exist; the guided plan, checkout (Stripe), and funding flow are missing.
Status: Partial.

## Shopper Wallet, Withdrawals, and Referrals

**39. Wallet and withdrawals**
Client wants: balance with pending and approved separated; locked PayPal or Venmo details; SMS-verified withdrawal; routing to manual review per admin rules; rejected requests return funds; failed-payout handling.
Currently have: wallet, withdrawals (PayPal/Venmo), payout methods, statuses, and admin review exist; SMS verification and some review flows are partial.
Status: Partial.

**40. Referrals**
Client wants: an "Invite Friends, Earn $5" program where the reward is earned only after the new shopper joins, claims, redeems, connects a payout method, and completes a withdrawal; with duplicate-account and review rules.
Currently have: referral invites and codes exist; the full multi-step qualification gating is partial.
Status: Partial.

**41. Payout-account safeguards**
Client wants: one PayPal or Venmo account per user; a duplicate payout account triggers review; a payout-method change goes to a review hold.
Currently have: one PayPal/Venmo account per user is enforced (a global unique constraint on provider + handle rejects a duplicate). The duplicate-account "request review" flow and the payout-method-change review hold are not implemented.
Status: Partial (one-account-per-user is Built; the review flows are Missing).

## Admin — Dashboard, Withdrawals, Brands, Campaign Approvals, Promo Codes

**42. Admin dashboard and revenue**
Client wants: a revenue summary separating subscription, rebate, and review fees (brand-funded rewards excluded); needs-attention links; per-brand revenue.
Currently have: an admin platform overview, transactions, and analytics; the revenue breakdown to the specified shape is partial.
Status: Partial.

**43. Withdrawal batch processing**
Client wants: status tabs (Ready for Batch, Manual Review, Processing, Completed, Failed); batch creation, PayPal file export, and result import; unique Batch IDs; no duplicate imports; partial-success handling; audit logging.
Currently have: payout batches (created, exported) and withdrawal statuses (pending, processing, paid, flagged, rejected), with export for manual processing, a mark-paid action, and a flag-to-hold path; importing PayPal result files and partial-success reconciliation are not implemented.
Status: Partial (export and mark-paid are Built; result import and partial-success are Missing).

**44. Campaign approval queue**
Client wants: a queue of new and revised campaigns for Nibbl review, with approve, reject, or request-changes; the approved version stays live while a revision is reviewed.
Currently have: none; there is no approval workflow.
Status: Missing.

**45. Promo codes**
Client wants: reusable promotional codes in addition to direct credit, with eligible charges, validity dates, and usage; credits never fund shopper rewards.
Currently have: direct promotional credit to a brand exists; reusable promo codes are missing.
Status: Partial.

## Admin — Shoppers, Suspensions, Referrals, Analytics, Receipt Discovery, Settings

**46. Shopper management and suspensions**
Client wants: shopper list and activity; per-brand suspensions and global suspension; alerts on repeated suspensions; wallet adjustments that require a reason and create a ledger entry.
Currently have: user list, suspend, and reactivate, plus fraud flags and audited wallet credits; the per-brand versus global suspension logic is partial.
Status: Partial.

**47. Referral management**
Client wants: referral qualification tracking, review of flagged referrals, and approve/reject/suspend actions.
Currently have: referral data exists; the admin flag-review flow is missing.
Status: Partial.

**48. Receipt brand discovery**
Client wants: identify unpartnered brands appearing on verified receipts; show leads (brand, product text, retailer, location, volume) without exposing shopper identity; export for sales.
Currently have: none.
Status: Missing.

**49. Revenue analytics**
Client wants: revenue sources; net revenue (credits, refunds, processing costs); trends; per-brand revenue contribution.
Currently have: platform analytics exist but not to this shape.
Status: Partial.

**50. Admin settings (thresholds and ranking config)**
Client wants: configurable withdrawal-review thresholds ($25 single, $100 rolling 30 days); referral flag toggles; Discovery Ranking configuration (Brand Interest and Store Match values); admin users and roles.
Currently have: admin users exist; configurable thresholds and ranking configuration are missing.
Status: Missing / Partial.

## Cross-cutting — Fraud and Abuse Controls

**51. Fraud and abuse controls**
Client wants: duplicate prevention; line-item matching; identity checks (email, phone, wallet, history); device checks (IP, browser, device); per-shopper redemption limits; reservation-abuse limits; velocity monitoring; manual-review triggers; one PayPal or Venmo per user; premium redemptions once per 30 days per campaign.
Currently have: duplicate hashing, line-item matching, velocity flagging, manual review, and the 30-day cooldown exist; device/IP checks are missing; identity and reservation-abuse limits are partial.
Status: Partial.

---

Note: this document is an audit comparing the client's requirements to the current code. Every status is traceable to the backend source. Items marked Missing or Partial that the team believes are complete can be re-verified against the code.
