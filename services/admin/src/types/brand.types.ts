export interface BrandDetail {
  id: string;
  sl: string;
  brandName: string;
  name?: string;
  legalName?: string;
  slug?: string;
  email: string;
  number: string;
  date: string;
  website?: string;
  logoUrl?: string;
  planName?: string;
  requestedPlan?: string;
  decisionReason?: string;
  description?: string;
  status?: string;
  source?: "brand" | "brand-application";
  canApprove?: boolean;
}

export interface BrandFilterState {
  date: string;
  brandName: string;
}
