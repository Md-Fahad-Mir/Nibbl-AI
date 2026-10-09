"use client";

import { useState } from "react";
import { AlertCircle, X } from "lucide-react";
import RedemptionsStats from "./RedemptionsStats";
import RedemptionsTable from "./RedemptionsTable";
import RedemptionDetailsView from "./RedemptionDetailsView";
import ReviewDecisionDrawer from "./ReviewDecisionDrawer";
import type { ReviewSelection } from "@/stores/useBrandApiStore";
import { ApiRecord, apiClient, backendApi, backendAssetUrl } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatDate, formatMoney, formatTime, toNumber } from "../../utils/backendMappers";

interface RedemptionItem {
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
  receiptLineItems?: ApiRecord[];
  status: "Pending" | "Approved" | "Rejected" | "Expired" | "Manual Review";
  issue?: string;
  priority?: "High" | "Medium";
  // Manual review: the raw queue item, its auto-approval deadline, and how
  // an approved redemption was decided.
  reviewItem?: Record<string, unknown>;
  deadlineAt?: string;
  approvalLabel?: string;
}

const receiptFallback = "/redemption/receipe.svg";
const receiptPreviewFallback = "/redemption/EvedenceSectionReceipe.svg";

const mapIssuedRedemption = (item: ApiRecord): RedemptionItem => ({
  id: String(item.id),
  userName: "",
  userEmail: String(item.user_email ?? ""),
  userAvatar: "",
  userIdCode: "",
  redemptionsCount: 0,
  reviewsCount: 0,
  campaignName: String(item.campaign_name ?? "Campaign"),
  subBrand: String(item.brand_name ?? ""),
  receiptThumbnailUrl: backendAssetUrl(item.receipt_image_url, receiptFallback),
  receiptImageUrl: backendAssetUrl(item.receipt_image_url, receiptPreviewFallback),
  receiptId: item.receipt ? String(item.receipt) : undefined,
  claimedTierLabel: String(item.approval_label ?? "Rewards"),
  approvalLabel: item.approval_label ? String(item.approval_label) : undefined,
  claimedTierValue: formatMoney(item.reward_amount),
  submittedDate: formatDate(item.issued_at ?? item.created_at),
  submittedTime: formatTime(item.issued_at ?? item.created_at),
  submittedAt: typeof (item.issued_at ?? item.created_at) === "string"
    ? String(item.issued_at ?? item.created_at)
    : undefined,
  status: "Approved",
});

const mapReviewQueueItem = (item: ApiRecord): RedemptionItem | null => {
  const receipt = (item.receipt || {}) as ApiRecord;
  const receiptStatus = String(receipt.status ?? "").toLowerCase();
  const queueStatus = String(item.status ?? "").toLowerCase();
  if (queueStatus === "resolved" && receiptStatus !== "rejected") return null;

  const imageUrl = backendAssetUrl(receipt.image_url, receiptPreviewFallback);
  const purchasedAt = receipt.purchased_at ?? item.created_at;
  // "Submitted" = when the shopper uploaded the receipt (not the purchase date).
  const uploadedAt = receipt.created_at ?? item.created_at;
  return {
    id: String(item.id),
    userName: String(receipt.user_name ?? "Customer"),
    userEmail: String(receipt.user_email ?? ""),
    userAvatar: backendAssetUrl(receipt.user_avatar_url, ""),
    userIdCode: String(receipt.id ?? item.id).slice(0, 8),
    redemptionsCount: 0,
    reviewsCount: 0,
    campaignName: String(receipt.campaign_name ?? "Campaign"),
    subBrand: String(receipt.brand_name ?? ""),
    receiptThumbnailUrl: imageUrl,
    receiptImageUrl: imageUrl,
    receiptId: receipt.id ? String(receipt.id) : undefined,
    receiptMerchant: String(receipt.merchant ?? receipt.brand_name ?? ""),
    receiptPurchasedAt: typeof purchasedAt === "string" ? purchasedAt : undefined,
    receiptTotal: receipt.total != null ? formatMoney(receipt.total) : undefined,
    receiptLineItems: Array.isArray(receipt.line_items) ? receipt.line_items as ApiRecord[] : [],
    claimedTierLabel: "Rewards",
    claimedTierValue: formatMoney(receipt.reward_amount),
    submittedDate: formatDate(uploadedAt),
    submittedTime: formatTime(uploadedAt),
    submittedAt: typeof uploadedAt === "string" ? uploadedAt : undefined,
    status: receiptStatus === "rejected" ? "Rejected" : "Manual Review",
    issue: String(receipt.decision_reason ?? "Receipt requires manual review"),
    priority: toNumber(receipt.total) >= 50 ? "High" : "Medium",
    reviewItem: item,
    deadlineAt: item.deadline_at ? String(item.deadline_at) : undefined,
  };
};

const mergeRedemptionDetail = (
  item: RedemptionItem,
  detail: ApiRecord
): RedemptionItem => {
  const campaign = (detail.campaign || {}) as ApiRecord;
  const customer = (detail.customer || {}) as ApiRecord;
  const receipt = (detail.receipt || {}) as ApiRecord;
  const imageUrl = backendAssetUrl(receipt.image_url, item.receiptImageUrl || receiptPreviewFallback);
  const purchasedAt = receipt.purchased_at ?? detail.issued_at;

  return {
    ...item,
    userName: String(customer.name ?? item.userName),
    userEmail: String(customer.email ?? item.userEmail),
    userAvatar: backendAssetUrl(customer.avatar_url, item.userAvatar || ""),
    redemptionsCount: toNumber(customer.redemptions_count ?? item.redemptionsCount),
    reviewsCount: toNumber(customer.reviews_count ?? item.reviewsCount),
    campaignName: String(campaign.name ?? item.campaignName),
    receiptThumbnailUrl: imageUrl,
    receiptImageUrl: imageUrl,
    receiptId: receipt.id ? String(receipt.id) : item.receiptId,
    receiptMerchant: String(receipt.merchant ?? item.receiptMerchant ?? item.subBrand),
    receiptPurchasedAt: typeof purchasedAt === "string" ? purchasedAt : item.receiptPurchasedAt,
    receiptTotal: receipt.total != null ? formatMoney(receipt.total) : item.receiptTotal,
    receiptLineItems: Array.isArray(receipt.line_items)
      ? receipt.line_items as ApiRecord[]
      : item.receiptLineItems,
    claimedTierValue: formatMoney(detail.reward_amount ?? item.claimedTierValue),
    submittedDate: formatDate(purchasedAt),
    submittedTime: formatTime(purchasedAt),
    submittedAt: typeof purchasedAt === "string" ? purchasedAt : item.submittedAt,
  };
};

const mergeRejectedReceipt = (
  item: RedemptionItem,
  receipt: ApiRecord
): RedemptionItem => {
  const purchasedAt = receipt.purchased_at ?? receipt.created_at ?? item.submittedAt;
  return {
    ...item,
    status: "Rejected",
    issue: String(receipt.decision_reason ?? item.issue ?? "Receipt rejected"),
    receiptId: receipt.id ? String(receipt.id) : item.receiptId,
    receiptMerchant: String(receipt.merchant ?? item.receiptMerchant ?? ""),
    receiptPurchasedAt:
      typeof purchasedAt === "string" ? purchasedAt : item.receiptPurchasedAt,
    receiptTotal:
      receipt.total != null ? formatMoney(receipt.total) : item.receiptTotal,
    receiptLineItems: Array.isArray(receipt.line_items)
      ? receipt.line_items as ApiRecord[]
      : item.receiptLineItems,
    claimedTierValue: formatMoney(receipt.reward_amount ?? item.claimedTierValue),
    submittedDate: formatDate(purchasedAt),
    submittedTime: formatTime(purchasedAt),
    submittedAt: typeof purchasedAt === "string" ? purchasedAt : item.submittedAt,
  };
};

export default function RedemptionsView() {
  const [selectedItem, setSelectedItem] = useState<RedemptionItem | null>(null);
  const [actionError, setActionError] = useState("");
  const [rejectedItems, setRejectedItems] = useState<RedemptionItem[]>([]);
  const issuedRedemptions = useBrandApiStore((state) => state.redemptions);
  const reviewQueue = useBrandApiStore((state) => state.reviewQueue);
  const selectedBrandId = useBrandApiStore((state) => state.selectedBrandId);
  const approveReviewQueueItem = useBrandApiStore((state) => state.approveReviewQueueItem);
  const declineReviewQueueItem = useBrandApiStore((state) => state.declineReviewQueueItem);
  const redemptions = [
    ...reviewQueue
      .map(mapReviewQueueItem)
      .filter((item): item is RedemptionItem => Boolean(item)),
    ...rejectedItems,
    ...issuedRedemptions.map(mapIssuedRedemption),
  ];

  const handleViewDetails = async (item: RedemptionItem) => {
    setActionError("");
    setSelectedItem(item);
    if (!selectedBrandId || item.status === "Manual Review" || item.status === "Rejected") return;

    try {
      const detail = await apiClient.request<ApiRecord>(
        backendApi.brand.redemptionDetail(selectedBrandId, item.id)
      );
      setSelectedItem((current) =>
        current?.id === item.id ? mergeRedemptionDetail(current, detail) : current
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not load redemption receipt details."
      );
    }
  };

  // Decisions happen in the review drawer: the brand selects lines and
  // Nibbl calculates the reward (errors surface inside the drawer).
  const handleApprove = async (id: string, selection: ReviewSelection) => {
    await approveReviewQueueItem(id, selection);
    setSelectedItem(null);
  };

  const handleReject = async (id: string, reasonCode: string, note: string) => {
    const source = redemptions.find((item) => item.id === id);
    const receipt = await declineReviewQueueItem(id, reasonCode, note);
    if (source) {
      const rejected = mergeRejectedReceipt(source, receipt);
      setRejectedItems((items) => [
        rejected,
        ...items.filter((item) => item.id !== id),
      ]);
    }
    setSelectedItem(null);
  };

  // Row approve/reject buttons open the review drawer.
  const openReview = (id: string) => {
    const item = redemptions.find((r) => r.id === id);
    if (item) void handleViewDetails(item);
  };
  const pendingCount = redemptions.filter((r) => r.status === "Manual Review").length;

  const isDetailsPage = selectedItem && (
    selectedItem.status === "Approved" ||
    selectedItem.status === "Rejected" ||
    selectedItem.status === "Expired"
  );

  if (isDetailsPage && selectedItem) {
    return (
      <RedemptionDetailsView
        redemption={selectedItem}
        onBack={() => setSelectedItem(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left font-manrope">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end w-full gap-4">
        <div className="flex flex-col gap-1.5 text-left">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight leading-none">
              Redemptions
            </h2>
            <span className="bg-[#001BD2]/10 text-[#001BD2] font-bold text-xs px-3 py-1 rounded-full flex items-center leading-none mt-0.5">
              {redemptions.length}
            </span>
          </div>
          <p className="text-[#454656] text-sm md:text-base font-medium mt-1">
            Manage and verify cashback claims across all active campaigns.
          </p>
        </div>

        {/* Stats stack next to header */}
        <RedemptionsStats />
      </div>

      {actionError && (
        <div className="bg-[#FFF5F5] border border-[#FFD6D6] text-[#BA1A1A] text-sm font-semibold rounded-2xl px-5 py-4 flex items-start justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">
                Backend Response
              </span>
              <span className="leading-relaxed">{actionError}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActionError("")}
            className="w-7 h-7 rounded-full border-none bg-transparent hover:bg-red-100 text-[#BA1A1A] cursor-pointer flex items-center justify-center flex-shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold rounded-2xl px-5 py-4">
          {pendingCount} receipt{pendingCount === 1 ? "" : "s"} awaiting your review. A receipt in manual review is
          approved automatically at the campaign&apos;s maximum reward exactly 7 days after submission if you don&apos;t
          approve or reject it before then. Automatic approval doesn&apos;t create a product alias.
        </div>
      )}

      {/* Main Redemptions List Table */}
      <RedemptionsTable
        redemptions={redemptions}
        onViewDetails={handleViewDetails}
        onApprove={openReview}
        onReject={openReview}
      />

      {/* Manual review decision drawer */}
      {selectedItem && !isDetailsPage && selectedItem.reviewItem && (
        <ReviewDecisionDrawer
          item={selectedItem.reviewItem}
          onClose={() => setSelectedItem(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

    </div>
  );
}
