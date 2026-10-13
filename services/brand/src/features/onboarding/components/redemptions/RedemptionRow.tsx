/* eslint-disable @next/next/no-img-element */
"use client";

import { autoApproveCountdown } from "./ReviewDecisionDrawer";
import { formatDate } from "../../utils/backendMappers";
import type { RedemptionItem } from "./types";

const STATUS_TEXT: Record<RedemptionItem["status"], string> = {
  Approved: "Approved",
  Rejected: "Rejected",
  Expired: "Expired",
  Pending: "Pending",
  "Manual Review": "Pending Review",
};

const statusStyles: Record<RedemptionItem["status"], string> = {
  Approved: "bg-[#F0FDF4] text-[#16A34A]",
  Rejected: "bg-[#FDF2F2] text-[#BA1A1A]",
  Expired: "bg-[#F8FAFC] text-[#64748B]",
  Pending: "bg-[#E2E7FF] text-[#001BD2]",
  "Manual Review": "bg-[#FFF7ED] text-[#D97706]",
};

const statusDotStyles: Record<RedemptionItem["status"], string> = {
  Approved: "bg-[#16A34A]",
  Rejected: "bg-[#BA1A1A]",
  Expired: "bg-[#64748B]",
  Pending: "bg-[#001BD2]",
  "Manual Review": "bg-[#D97706]",
};

/** Master Redemptions table row: customer, campaign, submitted, receipt
 *  summary, reward, status and the next action. */
export default function RedemptionRow({
  redemption,
  onViewDetails,
}: {
  redemption: RedemptionItem;
  onViewDetails: (item: RedemptionItem) => void;
}) {
  const pending = redemption.status === "Manual Review";
  const displayName = redemption.userName && redemption.userName !== "Customer" ? redemption.userName : redemption.userEmail;
  const initials = (displayName || "")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const details = [
    redemption.receiptPurchasedAt ? formatDate(redemption.receiptPurchasedAt) : "",
    redemption.receiptItemCount ? `${redemption.receiptItemCount} item${redemption.receiptItemCount === 1 ? "" : "s"}` : "",
    redemption.receiptTotal ?? "",
  ].filter(Boolean);
  const statusNote = pending
    ? autoApproveCountdown(redemption.deadlineAt)
    : redemption.status === "Approved"
      ? redemption.approvalLabel
      : redemption.status === "Rejected" && redemption.issue
        ? `Reason: ${redemption.issue}`
        : "";

  return (
    <tr className={`border-b border-[#EAEDFF] text-sm text-[#454656] ${pending ? "bg-[#FFFBF2]" : "hover:bg-[#F2F3FF]/30"}`}>
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-[#001BD2] text-white font-extrabold text-xs flex items-center justify-center">
            {redemption.userAvatar ? (
              <img src={redemption.userAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              initials || "U"
            )}
          </div>
          <span className="font-semibold text-[#131B2E] truncate max-w-[200px]">{displayName || "No customer info"}</span>
        </div>
      </td>
      <td className="p-4">
        <div className="flex flex-col text-xs gap-0.5">
          <span className="font-bold text-[#001BD2]">{redemption.campaignName}</span>
          {redemption.subBrand && <span className="text-slate-400">{redemption.subBrand}</span>}
        </div>
      </td>
      <td className="p-4">
        <div className="flex flex-col text-xs gap-0.5">
          <span className="font-semibold text-[#131B2E]">{redemption.submittedDate}</span>
          <span className="text-slate-400">{redemption.submittedTime}</span>
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-3">
          <img
            src={redemption.receiptThumbnailUrl}
            alt=""
            className="w-9 h-12 rounded-md border border-slate-100 object-contain bg-white flex-shrink-0"
          />
          <div className="flex flex-col text-xs gap-0.5">
            <span className="font-semibold text-[#131B2E]">
              {redemption.receiptMerchant || (pending ? "Receipt scanned" : "Receipt reviewed")}
            </span>
            <span className="text-slate-400">{details.length ? details.join(" · ") : "Details unverified"}</span>
          </div>
        </div>
      </td>
      <td className="p-4 font-bold text-[#131B2E]">{pending ? "Pending" : redemption.claimedTierValue}</td>
      <td className="p-4">
        <span className={`${statusStyles[redemption.status]} text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 w-fit`}>
          <span className={`${statusDotStyles[redemption.status]} w-1.5 h-1.5 rounded-full`} />
          {STATUS_TEXT[redemption.status]}
        </span>
        {statusNote && <span className="block mt-1 text-[11px] text-[#64748B] max-w-[220px]">{statusNote}</span>}
      </td>
      <td className="p-4 text-right">
        <button
          type="button"
          onClick={() => onViewDetails(redemption)}
          className={`h-9 px-4 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
            pending ? "bg-[#001BD2] text-white" : "border border-[#001BD2] text-[#001BD2] bg-white"
          }`}
        >
          {pending ? "Review Receipt" : "View Details"}
        </button>
      </td>
    </tr>
  );
}
