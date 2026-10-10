export interface StatCardData {
  id: string;
  title: string;
  value: string;
}

export interface MonthlyEarning {
  year?: string;
  month: string;
  amount: number;
  formattedAmount: string;
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
  | "brand"
  | "promo-codes"
  | "campaign-approvals"
  | "review-flags"
  | "brand-discovery"
  | "withdraw-request"
  | "payout-reviews"
  | "settings"
  | "logout";
