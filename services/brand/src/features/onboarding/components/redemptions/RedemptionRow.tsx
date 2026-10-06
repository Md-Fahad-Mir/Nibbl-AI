/* eslint-disable @next/next/no-img-element */
"use client";

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
  receiptLineItems?: Record<string, unknown>[];
  status: "Pending" | "Approved" | "Rejected" | "Expired" | "Manual Review";
  issue?: string;
  priority?: "High" | "Medium";
}

interface RedemptionRowProps {
  redemption: RedemptionItem;
  isManualReviewTab: boolean;
  onViewDetails: (item: RedemptionItem) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const statusStyles: Record<RedemptionItem["status"], string> = {
  Approved: "bg-[#F0FDF4] text-[#16A34A]",
  Rejected: "bg-[#FDF2F2] text-[#BA1A1A]",
  Expired: "bg-[#F8FAFC] text-[#64748B]",
  Pending: "bg-[#E2E7FF] text-[#001BD2]",
  "Manual Review": "bg-[#FFFBEB] text-[#D97706]",
};

const statusDotStyles: Record<RedemptionItem["status"], string> = {
  Approved: "bg-[#16A34A]",
  Rejected: "bg-[#BA1A1A]",
  Expired: "bg-[#64748B]",
  Pending: "bg-[#001BD2]",
  "Manual Review": "bg-[#D97706]",
};

export default function RedemptionRow({
  redemption,
  isManualReviewTab,
  onViewDetails,
  onApprove,
  onReject,
}: RedemptionRowProps) {
  const displayName = redemption.userName || redemption.userEmail;
  const initials = displayName
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const avatar = redemption.userAvatar ? (
    <img
      src={redemption.userAvatar}
      alt={displayName || "Customer"}
      className="w-full h-full object-cover"
    />
  ) : (
    initials || "U"
  );

  return (
    <tr className="border-b border-[#C5C5D9]/10 hover:bg-[#F2F3FF]/30 transition-colors text-sm text-[#454656] font-manrope">
      <td className="p-5 text-left">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-[#001BD2] text-white font-extrabold text-xs flex items-center justify-center">
            {avatar}
          </div>
          <div className="flex flex-col text-left min-w-0">
            {displayName ? (
              <span className="font-bold text-[#131B2E] truncate">
                {displayName}
              </span>
            ) : (
              <span className="font-bold text-[#454656]/60">No customer info</span>
            )}
            {redemption.userName && redemption.userEmail && (
              <span className="text-xs text-[#454656]/70 mt-0.5 truncate">
                {redemption.userEmail}
              </span>
            )}
            {isManualReviewTab && redemption.userIdCode && (
              <span className="text-[11px] text-[#454656]/60 font-semibold mt-0.5">
                ID: {redemption.userIdCode}
              </span>
            )}
          </div>
        </div>
      </td>

      <td className="p-5 text-left">
        <div className="flex flex-col text-xs gap-0.5">
          <span className="font-bold text-[#001BD2]">{redemption.campaignName}</span>
          {redemption.subBrand && (
            <span className="text-slate-400 font-medium">{redemption.subBrand}</span>
          )}
        </div>
      </td>

      {isManualReviewTab ? (
        <>
          <td className="p-5 text-left">
            <div className="flex flex-col items-start gap-0.5">
              <span className="font-bold text-[#131B2E] text-xs">
                {redemption.issue || "Manual review needed"}
              </span>
            </div>
          </td>
          <td className="p-5 text-left">
            <span className="font-medium text-[#131B2E] text-xs">
              {redemption.submittedDate}, {redemption.submittedTime}
            </span>
          </td>
          <td className="p-5 text-right">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => onViewDetails(redemption)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer border-none bg-transparent"
                title="View Details"
              >
                <img src="/redemption/viewIcon.svg" alt="View" className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={() => onApprove(redemption.id)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer border-none bg-transparent"
                title="Approve"
              >
                <img src="/redemption/ActionIcon.svg" alt="Approve" className="w-[18px] h-[12.5px]" />
              </button>
              <button
                onClick={() => onReject(redemption.id)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer border-none bg-transparent"
                title="Reject"
              >
                <img src="/redemption/BlockIcon.svg" alt="Reject" className="w-[13.3px] h-[16.6px]" />
              </button>
            </div>
          </td>
        </>
      ) : (
        <>
          <td className="p-5 text-center">
            <button
              onClick={() => onViewDetails(redemption)}
              className="w-11 h-[58px] bg-[#EAEDFF] rounded-lg overflow-hidden flex items-center justify-center border border-slate-100 shadow-sm cursor-pointer hover:scale-105 transition-transform mx-auto p-0"
              title="View receipt"
            >
              <img
                src={redemption.receiptThumbnailUrl}
                alt="Receipt"
                className="w-full h-full object-contain bg-white"
              />
            </button>
          </td>
          <td className="p-5 text-left">
            <span className="font-jakarta font-bold text-base text-[#131B2E]">
              {redemption.claimedTierValue}
            </span>
          </td>
          <td className="p-5 text-left">
            <div className="flex flex-col text-xs gap-0.5">
              <span className="font-semibold text-[#131B2E]">
                {redemption.submittedDate}
              </span>
              <span className="text-slate-400 font-medium">
                {redemption.submittedTime}
              </span>
            </div>
          </td>
          <td className="p-5 text-right">
            <div className="flex justify-end">
              <span
                className={`${statusStyles[redemption.status]} text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit`}
              >
                <span
                  className={`${statusDotStyles[redemption.status]} w-1.5 h-1.5 rounded-full`}
                />
                {redemption.status}
              </span>
            </div>
          </td>
        </>
      )}
    </tr>
  );
}
