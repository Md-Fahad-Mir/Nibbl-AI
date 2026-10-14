# QC — Admin Dashboard vs Master

Live build checked on production (admin.joinnibbl.com) on 2026-10-14 against the Master admin sheets (1–4) and mockups 36–39. Written requirements win where an older mockup label conflicts.

Status: **Open** = differs from the Master · **Fixed** = changed and re-checked · **OK** = matches · **Intentional** = kept on purpose (reason given)

## Shared layout

| # | Item | Master | Live | Status |
|---|---|---|---|---|
| H1 | Header | Search bar, notification bell, "Admin User / Nibbl Admin" + avatar | "Welcome, Riajul Admin / Have a nice day!" card | Fixed — admin name + "Nibbl Admin"; welcome card removed. No search box or bell added (there is no admin search or admin notification list behind them) |
| H2 | Sidebar items and order | Dashboard, Withdrawals, Brands, Campaign Approvals, Shoppers, Referrals, Promo Codes, Analytics, Settings | Same | OK |
| H3 | KPI cards | Icon + label + value | No icons (every page) | Fixed |

## Sheet 1 — Dashboard and Withdrawals

| # | Item | Master | Live | Status |
|---|---|---|---|---|
| D1 | Title | "Nibbl Admin Dashboard — Revenue and tasks that need attention." + date range | "Dashboard Overview" | Fixed |
| D2 | Revenue Summary | Subscription, Rebate Fee, Review Fee, Total Nibbl Revenue ("Brand-funded rewards shown separately") | Total first; no icons | Fixed |
| D3 | Needs Attention | Withdrawals needing review, campaigns awaiting approval, failed payouts, suspended shoppers | Those four + brand suspensions, flagged reviews, phone-change requests | Intentional — the extra three are Master items handled in Admin (review flags #26, phone changes) |
| D4 | Brand Revenue | Table with category/status filters, lowest-revenue sort | Present | OK |
| D5 | Brand-Funded Rewards | One line, separate from revenue | Three cards above Brand Revenue | Fixed |
| D6 | Old elements | — | Revenue Trend table (belongs to Analytics), Earnings chart, Recent Transactions table showing raw IDs as user names | Fixed — Revenue Trend table, Earnings chart and Recent Transactions removed (and their unused data loading) |
| W1 | Withdrawals: tabs, batch summary, Create Batch / Download PayPal File / Import PayPal Results, search, Manual Review panel, PayPal API — Coming Soon | Present | OK |

## Sheet 2 — Brands, Campaign Approvals and Promo Codes

| # | Item | Master | Live | Status |
|---|---|---|---|---|
| B1 | Brands summary + table + filters + sort | Present | OK (icons per H3) |
| B2 | Selected brand panel: Admin Mode banner, payment, wallet, credits, revenue, active campaigns; Open Brand Dashboard / Add Promotional Credit / Suspend Brand | Re-check on row select | OK — panel present; the table squeezes and cuts off Status when the panel opens (see X1) |
| C1 | Campaign Approvals: New / Revisions lists + Campaign Review panel + Request Changes / Reject / Approve | Present (Review campaigns as a third list) | OK |
| P1 | Promo Codes summary | Active Codes, Credits Issued, Credits Used | Missing | Fixed |
| P2 | Promo actions | "Create Promo Code" and "Add Brand Credit" buttons | Inline create form only; brand credit lives under Brands | Fixed |
| P3 | Promo table | Code, Credit, Applies To, Dates, Usage, Status + "Promotional credits never fund shopper rewards." | Code, Amount, Used, Valid until, Per brand, Status | Fixed |

## Sheet 3 — Shoppers, Suspensions and Referrals

| # | Item | Status |
|---|---|---|
| S1 | Shoppers list (status, wallet, redemptions, referrals, brand suspensions, last activity) + search | OK |
| S2 | Selected shopper: identity + status, tabs (Overview, Wallet Ledger, Claims & Reviews, Referrals, Suspensions), purchase activity, active cooldowns, Adjust Wallet / Add Internal Note / Global Suspend | OK — all panels and actions present (shown below the list) |
| U1 | Suspensions summary, list, review panel | OK (icons per H3) |
| R1 | Referrals tabs | Master: All, Flagged, Qualified, Paid, Rejected · Live: no "All" | Fixed |
| R2 | Referral filters | Master: search + status + date range · Live: none | Fixed |
| R3 | Referral details panel with flag reasons, Approve / Reject / Suspend | Open — re-check with a flagged referral |

## Sheet 4 — Analytics, Receipt Brand Discovery and Settings

| # | Item | Status |
|---|---|---|
| A1 | Revenue sources, net revenue cards, Revenue Trend, Brand Revenue Contribution + Export CSV | OK (icons per H3) |
| A2 | "Earnings" tab next to Analytics (old page, not in Master) | Fixed — old Earnings page removed (its totals disagreed with Revenue Analytics and it showed raw IDs as names); /earnings now opens Analytics |
| X1 | Receipt Brand Discovery: table is cut off (Receipts, Repeat purchases, Most recent columns not visible) | Fixed |
| X2 | Selected Brand Insight panel with outreach preview + Export Leads | OK — insight panel with outreach message, copy and rename |
| T1 | Settings page | Master: one page — Withdrawal Review Rules ($25 / $100), Referral Flag Rules, Discovery Ranking, Admin Users, View Audit Log, Save Changes · Live: old menu (Personal Information, Change Password, Platform Settings, FAQ, Privacy, Terms) with the Master settings hidden behind "Platform Settings" | Fixed |
| T2 | /support route | Empty folder, nothing links to it | OK (not a page) |
