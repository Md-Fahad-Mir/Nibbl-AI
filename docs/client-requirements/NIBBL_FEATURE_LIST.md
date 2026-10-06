# Nibbl AI — Feature List

Date: 2026-10-04

This feature list is based on two sources: the features already present in the current project code, and the new features the client has requested in the Master Requirements and Feature Document. Part A lists what the platform already does. Part B lists the new features the client wants added.

---

# Part A — Existing Features (in the current code)

## Shopper App and Web

- **Sign up** with full name, email, and password, with terms acceptance.
- **Sign in** with email or phone, "Remember me", and **social login** (Google, Apple).
- **Logout** and **token refresh**.
- **Email verification** with a 6-digit code, **resend code**, and **password forgot/reset**.
- **Profile management**: edit name, change password, add and verify phone, notification preferences.
- **Offer discovery feed** with **categories** and search.
- **Offer details** and offer content.
- **Save / bookmark** offers and brands.
- **Claim / reserve** an offer (with a 7-day expiry).
- **Receipt upload** with **OCR verification**.
- **QR and direct-URL offer access** (campaign links resolve to the offer).
- **Campaign cooldown and fallback offers**.
- **AI-generated product reviews** (answers to questions produce a review; $1 reward).
- **Rewards hub**: receipt history, redemptions, and activity.
- **Wallet**: balance, transaction history, statement, pending vs approved rewards.
- **Withdrawals** to PayPal or Venmo, with saved payout methods.
- **Referral invite and code**.
- **Notifications and reminders**: receipt reminders, new-offer alerts, inactivity and re-engagement (push).
- **FAQ, legal content** (Terms, Privacy), and **newsletter signup**.

## Brand Dashboard

- **Brand application and approval**, and **brand membership** roles (Owner, Admin, Member).
- **Brand analytics**: overview, campaign, product, and rebate summary.
- **Product Library**: products per flavor/size with a permanent Product ID, aliases, tags, category field, and product matching.
- **Rebate campaigns**: create and edit, reward tiers (allocation must total 100%), daily budget, minimum purchase in units, BOGO flag, restrictions, fallback offer, activate/pause.
- **Campaign assets**: permanent campaign URL and QR code.
- **Campaign preview** (read-only; consumes no budget and creates no reservation).
- **Brand wallet**: escrow funding, ledger, reserved funds (holds), transactions, and auto-pause when funds run out.
- **Redemptions and manual review queue**: approve or decline with a reason, and add product aliases.
- **Fraud flags**: duplicate, product-not-matched, velocity, and manual.
- **Plans and subscription**: plan tiers, fees, data-access tiers (enforced), and monthly subscription billing.
- **Customers**: brand customer directory with plan-based data access, activity, and statement.
- **Reviews**: product review list and summary, and the brand review list.
- **Brand profile**: update brand details and upload a brand logo.
- **Brand redemption detail** and an **enriched review-queue** receipt.

## Admin Dashboard

- **Brand management**: approve/reject applications, change plan, suspend/reactivate a brand, add promotional credit.
- **User management**: list users, suspend/reactivate, credit a user's wallet, approve a brand account.
- **Fraud-flag list, campaign list, transactions, audit logs, announcements, role statistics**.
- **Admin FAQ and legal-content management**.
- **Payout batches**: create and export; **withdrawals**: approve, reject, and mark paid.
- **Platform analytics**: overview and snapshots.

## Platform and System

- **OCR receipt extraction** and field capture.
- **Duplicate-receipt detection** using a receipt fingerprint.
- **One PayPal/Venmo account per user** (enforced).
- **30-day premium cooldown**.
- **Double-entry wallet ledger**.
- **Reservation system**: 7-day expiry, one active reservation per user per campaign, and a global reservation cap.

---

# Part B — New Features Requested by the Client

## Shopper App and Web

- **Location gate** before showing deals.
- **Active claim slots** (for example "3 of 5" per-shopper limit).
- **Review opportunities** surfaced from verified receipts, through an **AI chat review flow**.
- **SMS-verified withdrawals**.
- **Full referral qualification flow** (join, claim, redeem, connect payout, withdraw).
- **Consent capture** (separate Nibbl and Brand email/SMS consents).
- **Receipt reminders at 48 hours and 12 hours before expiry**.

## Brand Dashboard — Rebate Campaigns

- **Offer types**: Free, BOGO Free, Buy 1 Get 1 50% Off, and Buy X Get $Y Off, each with locked reward rules.
- **25-Hour Claim Capacity** (claims per rolling 25-hour cycle, replacing the dollar daily budget).
- **Retailer availability, featured retailers, and receipt eligibility** (Any Retailer vs Retailer Required).
- **Discovery geography** per campaign (Nationwide, Selected States, ZIP + radius).
- **Customer cooldown options** (None, 30, 60, 90 days, one-time).
- **Meta Pixel tracking** per campaign.
- **Nibbl campaign approval workflow** (Draft, Submit, Review, Approve or Changes Requested).
- **Full reservation term snapshot** (products, quantity, retailers, cooldown).

## Brand Dashboard — Review Campaigns

- **Dedicated review campaign** (daily budget, eligible products, optional brand questions).
- **AI chat review flow** (five adaptive questions plus one rotating brand question).
- **Review rules engine** ($1 reward, 30-day window, review reservation, 90-day per-product cooldown, maximum 5 opportunities per receipt).
- **Review moderation** (4–5 star auto-publish; 1–3 star held for brand response).
- **Review management and CSV export**.
- **Product ratings display** (star distribution, AI summary, brand responses).

## Brand Dashboard — Wallet, Plans, Analytics, Settings

- **Promotional credits** as a tracked balance.
- **Automatic wallet refill via Stripe**.
- **Weekly statements and detailed ledger export**.
- **Per-plan active-campaign limit enforcement** (1 / 3 / 10).
- **Plan recommendation** and **self-serve plan changes** (next-renewal, downgrade handling).
- **25-hour-cycle campaign performance states** (Exhausted Early, On Pace, Behind, Building Data).
- **Customer consent and opt-out tracking**, and **customer CSV export**.
- **Team roles** (Owner, Admin, Viewer) and **per-member email/SMS notification preferences**.
- **Meta Pixel ID validation** and **session security** (active sessions, sign out others).
- **Guided brand onboarding with Stripe checkout** and wallet funding.
- **Tag Generator** as a static "Coming Soon" page.

## Admin Dashboard

- **Campaign approval queue** (new and revised campaigns).
- **Promo codes** (reusable codes, in addition to direct credit).
- **Withdrawal batch import and partial-success handling**.
- **Per-brand and cross-brand suspensions** with repeated-suspension alerts.
- **Referral flag review**.
- **Receipt brand discovery** (unpartnered-brand leads from verified receipts).
- **Revenue analytics** (subscription, rebate, and review-fee breakdowns).
- **Admin settings**: withdrawal review thresholds, referral flag toggles, and discovery-ranking configuration.

## Platform and System

- **Per-line quantity allocation** on receipts.
- **Richer duplicate fingerprint** (store, register, and transaction number).
- **Device, IP, and browser fraud checks**.
- **Discovery ranking** (Base CVR × Store Match × Brand Interest).
- **Seven-day automatic approval** of pending receipts at the maximum reward.
- **Integrations**: Stripe (billing and refill), Meta Pixel (tracking), and an SMS/email provider (notifications, consent, verification).
