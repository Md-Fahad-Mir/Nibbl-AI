# QC — Shopper Website vs Master

Checked locally (seeded brand, two live campaigns, a shopper with a $18.50 wallet, a PayPal payout method and one active claim) at phone width (390 px) and desktop, on 2026-10-14, against the Master shopper sections and mockups 6, 9–13 and 33–35 ("Shopper App" flows — the website follows the same screens). Written requirements win where an older mockup label conflicts.

Status: **Open** = differs from the Master · **Fixed** = changed and re-checked · **OK** = matches · **Intentional** = kept on purpose (reason given)

## Shared layout

| # | Item | Master | Live | Status |
|---|---|---|---|---|
| L1 | Footer | — | Placeholder text: "Sing Up News Latter To get Update Conformation…", fake address "New York City, USA", phone "+254585222001445", "support@nibble.ai" (wrong domain), "2025 Our Website All over", a newsletter box that isn't connected | Fixed — placeholder footer replaced (support@joinnibbl.com, help & policy links, © Nibbl); fake address, phone, dead newsletter and generic social links removed |
| L2 | Leaked developer text | — | "Backend offer", "Claim the backend offer in NibblAI", "No receipt history from the backend.", "No image returned", "Profile changes saved to the backend.", "No message returned by backend." and others | Fixed — all developer wording replaced with shopper wording |
| L3 | Navigation | Bottom tabs: For You, My Offers (badge = pending actions), Wallet, Profile | Hamburger menu + bell + profile icon | Fixed — bottom tabs (For You, My Offers + pending-actions badge, Wallet, Profile) on phone-sized screens; desktop header uses the same names (user chose option A) |
| L4 | Raw values shown | — | Activity shows "rebate_reward"; notifications show "2026-10-14T04:28:43.270914Z" | Fixed — activity shows Rebate / Review reward / Referral / Withdrawal; notification dates readable |

## For You and offers (mockups 6, 9, 10)

| # | Item | Master | Live | Status |
|---|---|---|---|---|
| F1 | Location gate | "Find deals near you" — Allow Location / Enter ZIP before any deals | Present | OK |
| F2 | Home layout | Location bar, search, category tabs (For You, Snacks…), campaign cards | Old search box + big Wallet card + "Recent Offer" scan/upload tiles above the deals | Fixed — wallet card and Scan/Upload tiles removed; search, action prompt, then location + category tabs + campaign cards |
| F3 | Campaign card | Image, brand, headline, description, reward pill, "Buy at" retailer logos, Going fast | Present (no image locally — seed has none) | OK |
| F4 | Card → details | Card opens Campaign Details | "View Products" opens an old details page (ViewDetails) with "Save My Reward" email box | Fixed — cards open Campaign Details; old details page removed |
| F5 | Campaign Details | Image, headline, description, reward pill, Eligible Products slider with ratings, Where to Buy / Receipt Eligibility / Maximum Rebate / Offer Eligibility rows, Going fast, Claim This Offer | Claim screen mixes details and the reservation form; no product slider or eligibility rows | Fixed — image, brand, headline, description, reward pill, Eligible Products slider with per-product ratings, Where to Buy / Receipt Eligibility / Maximum Rebate / Offer Eligibility rows, Going fast, Claim This Offer, Share this deal, product reviews |
| F6 | Reserve Offer | Separate sheet: claim-slot dots, email, phone, Nibbl + brand consent, Continue | Present inside the details screen | Fixed — Reserve this offer sheet (slot dots, email, phone, two required consents, Continue) |
| F7 | Confirm Reservation | Product, Purchase at, exact deadline, "This will use slot 4 of 5", Confirm & Reserve / Back | Re-check | OK — product, purchase-at, exact deadline, slot use, Confirm & Reserve / Back |
| F8 | Return Action Prompt | "N actions waiting" with Submit Receipt / Save for Later and Browse More Offers | "Your Pending Rewards" list | Fixed — "N actions waiting" with Submit Receipt / Save for Later and Browse More Offers, shown first |
| F9 | Restriction pop-ups (RB-33, 1–10) | Built in the For You batch | OK |
| F10 | Logged-out first screen | Land on For You (location prompt, then campaign cards) | Old "Welcome to nibblAI" screen ("…rewards on amount needed", Start Scanning / Upload from Photos) | Fixed — removed; everyone lands on For You, sign-in appears when needed |

## My Offers and receipts (mockups 10–12)

| # | Item | Master | Live | Status |
|---|---|---|---|---|
| R1 | My Offers | Active offer cards with days left + Submit Receipt | "My Rewards" page: Active Claim row, Receipt History, Activity History, referral block | Fixed — My Offers cards: image, brand, offer, days left, Submit Receipt; receipts being checked; reservations get an additive campaign_image_url |
| R2 | Receipt Needed → Requirements → Take/Upload Photo → Review → Submitted | Six screens | Built (ReceiptSubmitFlow) — re-check against mockup 10 | OK — Receipt Requirements (7 points) → Add Your Receipt (Take / Choose Photo) → review → submitted |
| R3 | Receipt outcomes (accepted, manual review, unreadable, date/retailer fails, final rejection, notifications) | Seven messages | Built — re-check against mockup 12 | OK — all seven outcome messages present; the retailer outcome lists the required retailers inline instead of a separate button |

## Wallet, withdrawals, referrals (mockups 33–35)

| # | Item | Master | Live | Status |
|---|---|---|---|---|
| W1 | Wallet Overview | Available to withdraw, Pending approval, Withdraw, View wallet activity, Payout method card | Balance card + activity; payout method card missing on the wallet page | Fixed — payout method section on the Wallet page |
| W2 | Wallet Activity / Reward Details | Tabs, grouped Pending / Available / Completed, reward timeline | Present | OK |
| W3 | Withdrawal flow (5 steps) | Present and tested on production 13 Oct | OK |
| W4 | Payout Methods | PayPal / Venmo cards, security note, Add payout method | Re-check | Fixed — method cards with Added / Pending review, security note, Add payout method (add-only, no withdrawal needed) |
| X1 | Refer a Friend | Home, Share link, Share a product, Progress, Rules | Present, but inside My Rewards rather than Profile | Fixed — Refer a Friend moved to Profile |

## Profile and notifications

| # | Item | Status |
|---|---|---|
| P1 | Profile (account, locked phone, marketing preferences, policy center, settings) | OK (no mockup) |
| N1 | Notifications list: readable dates, item tap opens the related claim | Fixed — readable dates; tapping opens the claim, My Offers or Wallet |
