# QC — Brand Dashboard vs Master

Live build checked on production (brand.joinnibbl.com, test brand "Name of the Brand") on 2026-10-13 against the Master text and its brand mockups. Written requirements win where an older mockup label conflicts (Master implementation note).

Status: **Open** = differs from the Master · **Fixed** = changed and re-checked · **OK** = matches · **Intentional** = kept on purpose (reason given)

## Shared layout (every page)

| # | Item | Master | Live | Status |
|---|---|---|---|---|
| S1 | Sidebar labels | Rebate Campaigns, Review Campaigns | "Rebate", "Reviews" | Fixed |
| S2 | Sidebar order | Dashboard, Product Library, Rebate Campaigns, Review Campaigns, Redemptions, Analytics, Customers, Tag Generator, Plans, Wallet, Settings | Tag Generator last; Plans before Wallet | Fixed |
| S3 | Header name | Brand name from Brand Settings | Signed-in user's name + "brand" | Fixed |
| S4 | Header plan | One plan pill (e.g. "Pro Plan") linked to Plans | "PLAN Starter" text | Fixed |
| S5 | Header funds | Wallet icon + "Available Funds $1,471.80", linked to Wallet | "$1471.8" (no thousands separator / cents) | Fixed |
| S6 | Brand name consistency | One name from Brand Settings | Welcome says "Name of the Brand", Settings says "kitkat" | Fixed — Settings → Brand Name now edits the name shoppers and Nibbl see; the brand app shows it everywhere |
| S7 | Load time | — | Brand data appears 10–12 s after page load (header shows $0.00, lists look empty until then) | Fixed |
| S8 | Emoji | Icons only | "ℹ️" on Review Campaigns page | Fixed |
| S9 | Notification bell | Not in mockup header | Present | Intentional — in-app notifications are required (Settings §3) |

## Dashboard (mockup 1)

| # | Item | Master | Live | Status |
|---|---|---|---|---|
| D1 | Section titles | Rebate Snapshot / Review Snapshot | "Rebates · Last 30 days" / "Reviews · Last 30 days" | Fixed |
| D2 | Snapshot cards | Icons; Reviews row = Invitations, Completed (with Completion Rate beneath), Total Brand Cost | No icons; Completion Rate is its own 4th card | Fixed |
| D3 | Campaign table | Campaign names link to their pages; "View All Campaigns →" | Names not linked; extra ID line; footer says "active campaigns" though ended ones are included | Fixed |
| D4 | Date range control | Single "Last 30 Days" button | Extra "Daterange" label | Fixed |

## Product Library (mockup 2)

| # | Item | Status |
|---|---|---|
| P1 | Cards, Add/Edit Product, aliases, categories, DELETE confirm | OK |
| P2 | Card "…" menu; rating shown as "3" instead of "3.0" | Open (minor) |

## Rebate Campaigns (mockups 3–5)

| # | Item | Master | Live | Status |
|---|---|---|---|---|
| R1 | Page title | "Rebate Campaigns" + subtitle | "Rebates" with "Overview > Rebates" breadcrumb | Open |
| R2 | Status tabs | All, Draft, Pending Review, Scheduled, Active, Paused, Changes Requested, Ended — each with a count | Running, In Review, Paused, Completed (no counts, no All) | Open |
| R3 | Campaign slots | "2 of 3 active campaigns used · Upgrade to Scale for up to 10" box | Yellow banner | Open |
| R4 | Campaign card | Image, status pill, headline, description, dates, Claims / Active Claims / Pending Review / Redemptions / Redemption Rate / Reward Spend, Current Cycle Claims bar, info line, Edit Campaign + View Details, "…" menu | No image or dates; only Redemptions + Reward Spend; edit icon only | Open |
| R5 | Old summary block | Not in Master | "Rebate Campaign Performance" (Total Cashback, Avg. Claim Time, Active Users, "Budget savings") | Open — remove |
| R6 | Builder sections ①–⑧ | All present | All present and working | OK |
| R7 | Builder layout | Save Draft / Submit for Nibbl Review at top; locked System Rules Summary table; Featured Retailers box; cooldown as options; rich live preview (slider, Where to Buy, eligibility rows, Going fast) | Buttons at bottom; rules as bullets; simplified preview | Open |
| R8 | Suggested wording before a product is picked | — | "Buy one eligible this product product…" | Fixed |
| R9 | Campaign detail (results, cycle, Meta Pixel, link + QR, summary) | Present | Present | OK |

## Redemptions (mockups 14–15)

| # | Item | Master | Live | Status |
|---|---|---|---|---|
| X1 | Summary row | Pending Manual Review (auto-approves after 7 days), Approved, Rejected, Total Paid | Manual Queue + Total Paid only | Open |
| X2 | Tabs | All, Pending Review (n), Approved, Rejected, Expired | Approved, Rejected, Manual Review | Open |
| X3 | Filters | Search + Campaign, Product, Status, Submitted Date, Clear Filters | Search + Campaign + Product | Open |
| X4 | Priority queue banner | "Pending review queue (n) … auto-approves using the campaign's maximum eligible reward" | Missing | Open |
| X5 | Table | Receipt summary (retailer · date · items · total), "Auto-approves in N days", Review Receipt / View Details | Receipt thumbnail only; no countdown | Open |
| X6 | Manual receipt review screen (mockup 14) | Seven panels | Built earlier — re-check | Open |

## Review Campaigns (mockups 16–17)

| # | Item | Status |
|---|---|---|
| V1 | Create Review Campaign ①–⑤ + live preview | OK |
| V2 | Review Management: KPI icons/trends, product images, Verified Purchase badge, row detail drawer, reward column shows "—" | Open |
| V3 | Review Campaigns landing title "Review Performance" vs Master naming "Review Campaigns" | Open |

## Analytics (mockup 21)

| # | Item | Master | Live | Status |
|---|---|---|---|---|
| A1 | Title | "Analytics Overview — Understand your costs, results, and where to improve." + "Data through …" | "Analytics Hub" + overview/Rebates/Reviews/Products tabs | Open |
| A2 | Cost & Results | Total Spend, Avg. Cost per Rebate, Avg. Cost per Review, Completed Rebates, Completed Reviews, Unique Customers (icons + info) | Rebate/Review Brand Cost, Redemptions, Reviews Completed | Open |
| A3 | Customer & Conversion | Total Views, View-to-Claim Rate, New-to-Brand %, Returning % | Counts instead of % for new/returning | Open |
| A4 | Campaign Performance | Image, Avg. Claims / Cycle, Claim Limit / Cycle, Avg. Time to Exhaust, Status, Recommendation + footnote | No Avg. Claims / Claim Limit columns | Open |

## Customers (mockups 22–23)

| # | Item | Status |
|---|---|---|
| C1 | Summary cards: icons + info tooltips | Open |
| C2 | "LIVE DATA" badge (old element) | Fixed |
| C3 | Filters button; Open Claims pill ("1 open"/None); cooldown text ("Rebate: 18 days") | Open |
| C4 | Integrations: "Customer Integrations — Coming Soon" with logos + "API connections will be available in a future release." | Open |
| C5 | Customer Profile (mockup 22) | Built earlier — re-check |

## Wallet (mockup 24)

| # | Item | Status |
|---|---|---|
| W1 | Title "Wallet" + subtitle; Request Refund + Add Funds at top | Partly fixed (title + subtitle); top buttons in the Wallet rebuild |
| W2 | "Sovereign ID •••• fc52" on the balance card (old element) | Fixed |
| W3 | Transaction History table on the main page (Master: individual transactions live in the ledger download) | Open — remove |
| W4 | Balances, Campaign Funding, Automatic Refill, Spending Overview, Weekly Statements | OK (layout polish open) |

## Plans (mockup 25)

| # | Item | Status |
|---|---|---|
| L1 | Current plan, recommendation, three plans, comparison, billing history, plan-change rules | OK (content) |
| L2 | Layout polish: icons, "Current Plan" badge, recommendation points + Compare button, "Included for all plans" list, Schedule Upgrade/Downgrade labels, Plan Change Rules row | Open |

## Settings (mockup 26)

| # | Item | Status |
|---|---|---|
| T1 | Sections 1–5 (Profile, Team, Notifications, Tracking, Security) | OK (content; live uses tabs, mockup is one page) |
| T2 | Section 6 Account, Support & Integrations (Contact Nibbl Support, owner-only closure note, Klaviyo "Coming Soon · Scale") | Fixed |

## Tag Generator (mockup 27)

| # | Item | Status |
|---|---|---|
| G1 | Static Coming Soon page with the example artwork (Meta Ads, Retail Displays, On-Pack, Email, MMS, How It Will Work) | Fixed |

## Brand onboarding (mockups 28–32)

| # | Item | Status |
|---|---|---|
| O1 | Role gate, public homepage, plans, register, verify, checkout, activated, first dashboard, funding before launch | Built earlier to these mockups — re-check after the dashboard fixes |
