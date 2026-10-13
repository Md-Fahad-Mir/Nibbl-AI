export type RedemptionStatus = "Pending" | "Approved" | "Rejected" | "Expired" | "Manual Review";

export interface RedemptionItem {
  id: string;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  userIdCode: string;
  redemptionsCount: number;
  reviewsCount: number;
  campaignName: string;
  subBrand: string;
  receiptThumbnailUrl: string;
  claimedTierLabel: string;
  claimedTierValue: string;
  submittedDate: string;
  submittedTime: string;
  submittedAt?: string;
  receiptId?: string;
  receiptImageUrl?: string;
  receiptMerchant?: string;
  receiptPurchasedAt?: string;
  receiptTotal?: string;
  receiptItemCount?: number;
  receiptLineItems?: Record<string, unknown>[];
  status: RedemptionStatus;
  issue?: string;
  priority?: "High" | "Medium";
  // Manual review: the raw queue item, its auto-approval deadline, and how
  // an approved redemption was decided.
  reviewItem?: Record<string, unknown>;
  deadlineAt?: string;
  approvalLabel?: string;
}
