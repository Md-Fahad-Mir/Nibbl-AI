"use client";

import Image from "next/image";
import { imageUrl } from "../lib/offerMappers";

interface PendingRewardsProps {
  reservations?: Record<string, unknown>[];
  receipts?: Record<string, unknown>[];
  reviewOpportunities?: Record<string, unknown>[];
  onUploadReceiptClick?: (reservationId: string) => void;
  onLeaveReviewClick?: (opportunityId: string) => void;
}

export default function PendingRewards({
  reservations = [],
  receipts = [],
  reviewOpportunities = [],
  onUploadReceiptClick,
  onLeaveReviewClick,
}: PendingRewardsProps) {
  const pendingReceipts = receipts.filter((receipt) =>
    ["pending", "manual_review", "processing"].includes(
      String(receipt.status || "").toLowerCase()
    )
  );
  const hasPendingRewards =
    reservations.length > 0 ||
    pendingReceipts.length > 0 ||
    reviewOpportunities.length > 0;

  return (
    <div className="w-full max-w-[1137px] mx-auto font-sans flex flex-col gap-6">
      {/* Title */}
      <h2 className="text-[24px] font-semibold leading-[29px] text-[#1F1D1D]">
        Your Pending Rewards
      </h2>

      {/* Cards list (Figma Frame 2147229293 layout width 760px on desktop) */}
      <div className="flex flex-wrap gap-8 items-center justify-center lg:justify-start">
        {reservations.map((reservation, index) => (
          <PendingRewardCard
            key={`reservation-${String(reservation.id || index)}`}
            item={reservation}
            type="receipt"
            onAction={() => onUploadReceiptClick?.(String(reservation.id || ""))}
          />
        ))}

        {reviewOpportunities.map((opportunity, index) => (
          <PendingRewardCard
            key={`review-${String(opportunity.id || index)}`}
            item={opportunity}
            type="review"
            onAction={() =>
              onLeaveReviewClick?.(String(opportunity.id || ""))
            }
          />
        ))}

        {pendingReceipts.map((receipt, index) => (
          <PendingRewardCard
            key={`receipt-${String(receipt.id || index)}`}
            item={receipt}
            type="verification"
          />
        ))}

        {!hasPendingRewards && (
          <div className="w-full rounded-lg border border-gray-100 bg-white p-6 text-sm text-gray-400 shadow-[0px_2px_7.6px_rgba(0,0,0,0.08)]">
            No pending rewards from the backend.
          </div>
        )}
      </div>
    </div>
  );
}

function PendingRewardCard({
  item,
  type,
  onAction,
}: {
  item: Record<string, unknown>;
  type: "receipt" | "review" | "verification";
  onAction?: () => void;
}) {
  const image = imageUrl(
    item.product_image || item.image || item.campaign_image,
    ""
  );
  const title = String(
    item.product_name || item.campaign_name || "Pending reward"
  );
  const brand = String(item.brand_name || "Brand");
  const expires = String(item.expires_at || item.end_at || "").slice(0, 10);
  const reward = formatRewardAmount(item.reward_amount, type === "review" ? "1.00" : "0.00");
  const isReview = type === "review";
  const isVerification = type === "verification";

  return (
    <div className="w-full max-w-[364px] min-h-[156px] bg-[#FEFEFE] shadow-[0px_2px_7.6px_rgba(0,0,0,0.12)] rounded-lg p-2 pl-3 flex gap-[12px] items-center border border-gray-50 flex-shrink-0">
      <div className="w-[100px] h-[111px] bg-gray-50 rounded-lg overflow-hidden relative flex-shrink-0">
        {image ? (
          <Image
            src={image}
            alt={title}
            fill
            sizes="100px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] text-gray-400">
            No image returned
          </div>
        )}
      </div>

      <div className="flex-grow min-w-0 min-h-[140px] p-3 flex flex-col gap-4 justify-between">
        <div className="w-full flex flex-col gap-1.5">
          <div className="w-full h-[15px] flex justify-between items-center text-[12px] font-normal leading-[15px] text-[#4D4D4D]">
            <span className="truncate pr-1">{brand}</span>
            <span className="flex-shrink-0">
              {expires ? `Expires ${expires}` : "No expiry"}
            </span>
          </div>

          <div className="w-full flex flex-col gap-1">
            <h3 className="text-[16px] font-semibold leading-[19px] text-[#2D2D2D] truncate w-full">
              {title}
            </h3>
            <span className="text-[14px] font-medium leading-[17px] text-[#2D2D2D] truncate">
              {isReview
                ? "Review invitation"
                : isVerification
                  ? `${reward} verification pending`
                  : `${reward} reward`}
            </span>
          </div>
        </div>

        <button
          onClick={onAction}
          disabled={isVerification}
          className={`w-full max-w-[220px] h-[34px] ${
            isReview
              ? "bg-gradient-to-b from-[#FBDC40] to-[#FBDC40] text-[#1F1D1D]"
              : isVerification
                ? "bg-[#F5F5F5] text-[#707070]"
              : "bg-gradient-to-b from-[#3E3EDF] to-[#3E3EDF] text-[#FEFEFE]"
          } hover:opacity-90 active:scale-[0.98] disabled:cursor-default disabled:active:scale-100 text-[18px] font-medium leading-[22px] rounded-lg shadow-[0_4px_4px_rgba(0,0,0,0.12),inset_0_4px_4px_rgba(255,255,255,0.12)] flex items-center justify-center cursor-pointer focus:outline-none min-w-0`}
        >
          {isReview
            ? `Leave Review for ${reward}`
            : isVerification
              ? "Verification Pending"
              : "Upload Receipt"}
        </button>
      </div>
    </div>
  );
}

const formatRewardAmount = (value: unknown, fallback: string) => {
  const amount = String(value || fallback);
  return amount.startsWith("$") ? amount : `$${amount}`;
};
