"use client";

import { useState } from "react";
import Image from "next/image";
import { imageUrl } from "../lib/offerMappers";

// Master "Return Action Prompt": cards the shopper chose to "Save for Later"
// stay in My Offers but leave this carousel for the rest of the visit.
const SAVED_KEY = "nibbl-saved-for-later";
const readSaved = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(SAVED_KEY) || "[]");
  } catch {
    return [];
  }
};

/** Exact time left until a claim's receipt deadline, e.g. "2d 4h left". */
export const timeRemaining = (value: unknown) => {
  const deadline = Date.parse(String(value ?? ""));
  if (Number.isNaN(deadline)) return "";
  const minutes = Math.max(0, Math.floor((deadline - Date.now()) / 60000));
  if (minutes === 0) return "Expired";
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return `${d ? `${d}d ` : ""}${d || h ? `${h}h ` : ""}${d ? "" : `${m}m `}left`;
};

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
  const [saved, setSaved] = useState<string[]>(() => (typeof window === "undefined" ? [] : readSaved()));
  const saveForLater = (key: string) => {
    const next = [...saved, key];
    setSaved(next);
    try {
      sessionStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      // Per-visit convenience only.
    }
  };
  const visibleReservations = reservations.filter((r) => !saved.includes(`receipt:${String(r.id)}`));
  const visibleReviews = reviewOpportunities.filter((o) => !saved.includes(`review:${String(o.id)}`));
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

      {/* Swipeable carousel of pending actions (Master: Return Action Prompt) */}
      <div className="flex gap-6 items-stretch overflow-x-auto snap-x snap-mandatory pb-3 -mx-1 px-1">
        {visibleReservations.map((reservation, index) => (
          <PendingRewardCard
            key={`reservation-${String(reservation.id || index)}`}
            item={reservation}
            type="receipt"
            onAction={() => onUploadReceiptClick?.(String(reservation.id || ""))}
            onSaveForLater={() => saveForLater(`receipt:${String(reservation.id)}`)}
          />
        ))}

        {visibleReviews.map((opportunity, index) => (
          <PendingRewardCard
            key={`review-${String(opportunity.id || index)}`}
            item={opportunity}
            type="review"
            onAction={() =>
              onLeaveReviewClick?.(String(opportunity.id || ""))
            }
            onSaveForLater={() => saveForLater(`review:${String(opportunity.id)}`)}
          />
        ))}

        {pendingReceipts.map((receipt, index) => (
          <PendingRewardCard
            key={`receipt-${String(receipt.id || index)}`}
            item={receipt}
            type="verification"
          />
        ))}

        {hasPendingRewards && !visibleReservations.length && !visibleReviews.length && !pendingReceipts.length && (
          <div className="w-full rounded-lg border border-gray-100 bg-white p-6 text-sm text-gray-500">
            You saved your pending actions for later — find them in My Offers.
          </div>
        )}

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
  onSaveForLater,
}: {
  item: Record<string, unknown>;
  type: "receipt" | "review" | "verification";
  onAction?: () => void;
  onSaveForLater?: () => void;
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
  const remaining = type === "receipt" ? timeRemaining(item.expires_at) : "";
  const reward = formatRewardAmount(item.reward_amount, type === "review" ? "1.00" : "0.00");
  const isReview = type === "review";
  const isVerification = type === "verification";

  return (
    <div className="w-[88%] sm:w-full max-w-[364px] min-h-[156px] bg-[#FEFEFE] shadow-[0px_2px_7.6px_rgba(0,0,0,0.12)] rounded-lg p-2 pl-3 flex gap-[12px] items-center border border-gray-50 flex-shrink-0 snap-start">
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
            <span className={`flex-shrink-0 ${remaining ? "font-semibold text-[#E65353]" : ""}`}>
              {remaining || (expires ? `Expires ${expires}` : "No expiry")}
            </span>
          </div>

          <div className="w-full flex flex-col gap-1">
            <h3 className="text-[16px] font-semibold leading-[19px] text-[#2D2D2D] truncate w-full">
              {title}
            </h3>
            <span className="text-[14px] font-medium leading-[17px] text-[#2D2D2D] truncate">
              {isReview
                ? `Review invitation · earn ${reward}`
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
            ? "View Details"
            : isVerification
              ? "Verification Pending"
              : "Submit Receipt"}
        </button>
        {onSaveForLater && (
          <button type="button" onClick={onSaveForLater}
            className="text-[13px] font-medium text-[#575757] hover:underline cursor-pointer self-start -mt-2">
            Save for Later
          </button>
        )}
      </div>
    </div>
  );
}

const formatRewardAmount = (value: unknown, fallback: string) => {
  const amount = String(value || fallback);
  return amount.startsWith("$") ? amount : `$${amount}`;
};
