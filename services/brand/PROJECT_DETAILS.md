# NibbleAI Brand Dashboard

## ⚡ Shortcut Summary
**NibbleAI Brand Dashboard** is a premium, high-density Next.js web application built with TypeScript and Tailwind CSS. It enables brands to configure automated cashback rebates, audit creator review submissions, moderate pending redemptions, check analytics, handle user billing ledgers, and manage customer directories under a responsive, bento-grid styled architecture.

---

## 🛠️ Technology Stack
- **Framework**: Next.js 16 (App Router & Turbopack)
- **Styling**: Tailwind CSS & Vanilla CSS Variables
- **Icons**: Lucide React
- **Language**: TypeScript (Strict checks)
- **State Management**: React Client State Hooks (`useState`, `useEffect`)

---

## 🎨 Design System & Visual Guidelines
The visual interface is built to appear extremely premium, using custom fonts (Plus Jakarta Sans & Manrope) and a high-fidelity color palette:
- **Primary Accent**: `#001BD2` (Deep Indigo Blue) / Light Blue Accent: `#E2E7FF`
- **Dark Headings**: `#131B2E` (Navy Slate)
- **Secondary Subtitles**: `#454656` (Cool Grey)
- **Growth/Success Indicator**: `#059669` (Teal Green) / Background: `#E6F4EA`
- **Destructive/Suspended**: `#BA1A1A` (Crimson Red) / Background: `#FEE2E2`

### Core Development Constraints
1. **Line-Count Limits**: All subcomponents must be kept strictly **under 130 lines of code** for maximum reusability and clean structures.
2. **Width & Responsive Layouts**: Stages must scale responsively and occupy full width (`w-full`) to support mobile, tablet, and desktop screens without hard-coded wrapper clipping.
3. **Table Alignments**: direct flexbox attributes must not be placed on direct `<td>` tags (to prevent Turbopack compilation layout shifts). Instead, wrap internal content inside a flex child `<div>`.

---

## 📁 Project Architecture & Components Map
All front-end domains reside pagewise in `src/features/onboarding/components/`:

```
src/features/onboarding/components/
├── layout/                  # Navigation frames (Sidebar, Header)
├── dashboard/               # Main overview statistics and recent campaigns
├── product-library/         # Product catalog management and details
├── rebates/                 # Multi-tier cashback wizard steps
├── reviews/                 # Creator reviews campaign builder wizard
├── reviews-management/      # Ratings ledger and AI moderation chat log panels
├── redemptions/             # Receipt auditing desks and timeline profiles
├── settings/                # Profile forms, team directories, and active logs
├── wallet/                  # Billing overview cards and transaction histories
├── analytics/               # Performance tabs (Overview, Rebates, Reviews)
└── customers/               # Customer Directory and warning modals
```

### Module Breakdown
- **Customers**: Contains [CustomersView.tsx](file:///c:/Saiful/nibbleAi_BrandDashboard/src/features/onboarding/components/customers/CustomersView.tsx), [CustomerMetrics.tsx](file:///c:/Saiful/nibbleAi_BrandDashboard/src/features/onboarding/components/customers/CustomerMetrics.tsx), [CustomerLedger.tsx](file:///c:/Saiful/nibbleAi_BrandDashboard/src/features/onboarding/components/customers/CustomerLedger.tsx), [SuspendCustomerModal.tsx](file:///c:/Saiful/nibbleAi_BrandDashboard/src/features/onboarding/components/customers/SuspendCustomerModal.tsx), and [CustomerProfileView.tsx](file:///c:/Saiful/nibbleAi_BrandDashboard/src/features/onboarding/components/customers/CustomerProfileView.tsx).
- **Wallet**: Contains [WalletView.tsx](file:///c:/Saiful/nibbleAi_BrandDashboard/src/features/onboarding/components/wallet/WalletView.tsx), [WalletOverview.tsx](file:///c:/Saiful/nibbleAi_BrandDashboard/src/features/onboarding/components/wallet/WalletOverview.tsx), and [WalletDetails.tsx](file:///c:/Saiful/nibbleAi_BrandDashboard/src/features/onboarding/components/wallet/WalletDetails.tsx).
- **Analytics**: Contains [AnalyticsView.tsx](file:///c:/Saiful/nibbleAi_BrandDashboard/src/features/onboarding/components/analytics/AnalyticsView.tsx), [AnalyticsOverview.tsx](file:///c:/Saiful/nibbleAi_BrandDashboard/src/features/onboarding/components/analytics/AnalyticsOverview.tsx), [AnalyticsRebates.tsx](file:///c:/Saiful/nibbleAi_BrandDashboard/src/features/onboarding/components/analytics/AnalyticsRebates.tsx), and [AnalyticsReviews.tsx](file:///c:/Saiful/nibbleAi_BrandDashboard/src/features/onboarding/components/analytics/AnalyticsReviews.tsx).
