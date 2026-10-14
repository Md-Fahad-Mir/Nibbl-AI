export interface StatCardData {
  id: string;
  title: string;
  value: string;
}

export interface Transaction {
  id: string;
  transactionId: string;
  userName: string;
  brandName: string;
  amount: string;
  date: string;
}

export type SidebarNavItem =
  | "dashboard"
  | "earnings"
  | "users"
  | "suspensions"
  | "analytics"
  | "brand"
  | "promo-codes"
  | "campaign-approvals"
  | "review-flags"
  | "brand-discovery"
  | "referrals"
  | "refunds"
  | "withdraw-request"
  | "payout-reviews"
  | "settings"
  | "logout";
