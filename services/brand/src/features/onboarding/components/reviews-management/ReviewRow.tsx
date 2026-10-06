/* eslint-disable @next/next/no-img-element */
"use client";

import AIChatHistory from "./AIChatHistory";
import FinalReviewText from "./FinalReviewText";

interface ReviewItem {
  id: string;
  customerName: string;
  customerEmail: string;
  customerAvatar?: string;
  productName: string;
  date: string;
  rating: number;
  reward: string;
  status: "Approved" | "Pending Approval";
  reviewText: string;
  chatMessages: { id: string; sender: "assistant" | "shopper"; text: string }[];
}

interface ReviewRowProps {
  review: ReviewItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onApprove?: () => void;
  showReward: boolean;
}

export default function ReviewRow({
  review,
  isExpanded,
  onToggleExpand,
  onApprove,
  showReward,
}: ReviewRowProps) {
  const columnCount = showReward ? 6 : 5;

  return (
    <>
      {/* Regular Row */}
      <tr className={`border-b border-[#C5C5D9]/10 transition-colors font-manrope text-sm text-[#454656] ${
        isExpanded ? "bg-[#001BD2]/5" : "hover:bg-slate-50/50"
      }`}>
        {/* Customer Column */}
        <td className="p-6 flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-full bg-[#ACEDFF] flex items-center justify-center text-[#004956] font-bold text-sm overflow-hidden flex-shrink-0">
            {review.customerAvatar ? (
              <img src={review.customerAvatar} alt={review.customerName} className="w-full h-full object-cover" />
            ) : (
              review.customerName.charAt(0)
            )}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-[#131B2E]">{review.customerName}</span>
            {review.customerEmail && (
              <span className="text-xs text-[#454656]/70 mt-0.5">{review.customerEmail}</span>
            )}
          </div>
        </td>

        {/* Product Name Column */}
        <td className="p-6 text-left font-semibold text-[#131B2E] max-w-[200px] truncate">
          {review.productName}
        </td>

        {/* Date Column */}
        <td className="p-6 text-left">{review.date}</td>

        {/* Star Rating Column */}
        <td className="p-6 text-left">
          <div className="flex gap-1.5 items-center">
            {Array.from({ length: 5 }).map((_, idx) => (
              <img
                key={idx}
                src="/reviews/star.svg"
                alt="Star"
                className={`w-3.5 h-3.5 object-contain ${idx < review.rating ? "" : "opacity-30"}`}
              />
            ))}
          </div>
        </td>

        {/* Reward Column */}
        {showReward && (
          <td className="p-6 text-left">
            <div className="flex items-center gap-1 bg-[#F0FDF4] text-[#15803D] text-[11px] font-bold px-2.5 py-1 rounded-full uppercase w-fit tracking-wider">
              <span className="w-1.5 h-1.5 bg-[#15803D] rounded-full"></span>
              {review.reward}
            </div>
          </td>
        )}

        {/* Moderation Expand/Collapse Controls */}
        <td className="p-6 text-right">
          <button
            onClick={onToggleExpand}
            className="w-8 h-8 rounded-lg hover:bg-slate-100/80 flex items-center justify-center text-[#001BD2] font-bold transition-all border-none cursor-pointer"
          >
            <span className={`transform transition-transform ${isExpanded ? "rotate-180" : ""}`}>
              ▼
            </span>
          </button>
        </td>
      </tr>

      {/* Expanded Row Box */}
      {isExpanded && (
        <tr className="bg-[#001BD2]/5 border-b border-[#C5C5D9]/10">
          <td colSpan={columnCount} className="p-6">
            <div className="flex flex-col lg:flex-row gap-6 w-full items-stretch justify-center max-w-[900px] mx-auto">
              <AIChatHistory messages={review.chatMessages} />
              <FinalReviewText
                reviewText={review.reviewText}
                onApprove={onApprove}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
