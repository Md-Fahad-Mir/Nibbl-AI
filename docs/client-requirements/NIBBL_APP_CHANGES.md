# Nibbl AI — Shopper App & Web: Features and New Changes

Date: 2026-10-04

Scope: the shopper-facing mobile app and web platform only (not the brand or admin dashboards). Part A lists what the app already does. Part B lists the new changes the client wants in the app, from the Master Requirements. Bold = the feature/screen.

---

# Part A — Existing App Features

- **Sign up / Sign in** (email or phone, remember me) and **social login** (Google, Apple).
- **Email verification** (6-digit code) and **password reset**.
- **Offer discovery feed** with **categories** and search.
- **Offer details** and content.
- **Save / bookmark** offers and brands.
- **Claim / reserve** an offer and **upload a receipt**.
- **QR / direct-link** offer access.
- **Cooldown and fallback offers**.
- **AI-generated reviews** (answer questions, earn $1).
- **Rewards hub** (pending rebates, receipt history, activity).
- **Wallet** (balance, transactions, pending vs approved) and **withdrawals** (PayPal/Venmo).
- **Referral** invite and code.
- **Notifications and reminders** (push).
- **Profile, FAQ, legal content, newsletter**.

---

# Part B — New App Changes (client requirements)

## 1. Discovery and Location

- **Location gate** — "Find deals near you": ask the shopper to allow location or enter a ZIP before any deals are shown; save it to avoid re-asking.
- **Geography-filtered feed** — only show campaigns eligible for the shopper's location (Nationwide, Selected States, or ZIP + radius).
- **Campaign cards (not product cards)** on the "For You" feed; up to 24 per category; show reward amount, participating retailers, campaign name, and a save/heart.
- **"Going Fast" indicator** when 20% or less of the claim capacity remains.
- **Claim from Campaign Details**, not directly from the card.
- **Direct entry** (QR code, Meta ad, email/social link) opens that one specific deal and bypasses the location gate; "Explore More Offers" then asks for location before showing discovery.

## 2. Campaign Details (shopper view)

- Show **eligible products**, **participating retailers** (or "Any Retailer"), **receipt requirements**, **maximum rebate**, **campaign-specific cooldown**, and share/save.
- **Retailer-required wording** shown clearly before and after claiming, in My Offers, during submission, and in errors.

## 3. Reserve and Confirm

- **Active claim-slot usage** shown to the shopper (for example "3 of 5 used").
- Prepopulate email/phone if logged in; collect them if logged out.
- **Two separate consent checkboxes**: Nibbl email/SMS, and Brand email/SMS.
- A **confirmation screen** before reserving: chosen product, retailer requirements, reward, exact deadline, and resulting slot usage.
- The **7-day window starts at confirmation**; the receipt date must be on or after the reservation.

## 4. My Offers and Return Prompts

- A **swipeable carousel** of pending actions on return.
- **Receipt card**: Submit Receipt, exact time remaining, Save for Later.
- **Review card**: appears only when a review campaign is available; View Details, Save for Later.
- A **badge** that counts pending actions (not total offers).

## 5. Receipt Submission

- **Upload only inside the active campaign**; one photo first, request another only if needed; let the shopper review the image before submitting.
- The **claim slot stays occupied** during processing, resubmission, and manual review.
- **One resubmission** allowed before the deadline; the deadline never restarts.
- **Outcome notifications**: accepted, manual review, unreadable, date/retailer rejection, final rejection.

## 6. Restriction Pop-ups

Clear shopper messages for: required consent, all claim slots occupied, campaign already claimed, campaign-specific cooldown, one-time campaign already redeemed, campaign not started, campaign paused or ended, claim capacity exhausted, eligible retailer required, and campaign funds/end state.

## 7. Review Opportunity and AI Chat Review (major new flow)

- After a verified rebate receipt, **matching review opportunities appear in My Offers** (campaign image, $1 reward, 30-day deadline, "Claim $1").
- **Confirm Product** (image shown); if the receipt could match more than one product, let the shopper **select the correct product**.
- Request **consent only if not already opted in**.
- **"Share Your Voice"**: confirmed product, $1 reward, 30 days remaining, estimated time.
- **AI chat review**: starts with a product-based question, then **five adaptive questions** (suggested or custom answers) plus **one rotating brand question**; captures recommendation/repurchase and a **1–5 star rating**.
- **Generated review** (AI title and body); shopper can **edit or regenerate**; final approval; display name is first name + last initial.
- Submitting **adds $1 immediately**; 4–5 star reviews publish immediately; 1–3 star reviews enter a brand-response period.

## 8. Product Reviews Display (shopper)

- Campaign details show **each eligible product's lifetime rating and review count**.
- **Reviews overview + AI summary**: lifetime rating, star distribution, recommendation rate, buy-again rate, and a concise AI summary.
- **All product reviews** list, sortable (Newest, Highest, Lowest, Most Helpful), with the **verified-purchase and rewarded-review disclosure**, **mark helpful**, and the **brand's public response**.

## 9. Wallet and Withdrawals

- Wallet shows **available balance, pending vs approved rewards, reward details, and saved payout methods**.
- **Secure withdrawal**: enter amount, confirm locked PayPal/Venmo, **SMS verification**, submit; some requests route to manual review automatically.
- **"Additional review needed"** popup when a withdrawal is held; the wallet keeps showing it as Processing.
- **Duplicate payout account** and **payout-method-change** messages (Request Review / review-pending).

## 10. Referrals

- Share a **general referral link or a specific product deal** and track qualification progress.
- The referral reward is earned only after the new shopper: **joins → claims → completes an approved redemption → connects a payout method → completes a withdrawal**.

## 11. Notifications and Reminders

- **Reservation confirmation** immediately; **receipt reminders at 48 hours and 12 hours** before expiry; submission/manual-review confirmation; approval/rejection (in-app + email); claim expiration.
- Push themes: upload your receipt, finish your review, rewards waiting, new offers available, haven't logged in recently.
