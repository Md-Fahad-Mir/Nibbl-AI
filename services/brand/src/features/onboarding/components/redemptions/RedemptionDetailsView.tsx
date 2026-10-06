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

interface RedemptionDetailsViewProps {
  redemption: RedemptionItem;
  onBack: () => void;
}

const hasValue = (value: unknown) =>
  typeof value === "string" ? value.trim().length > 0 : value != null;

export default function RedemptionDetailsView({
  redemption,
  onBack,
}: RedemptionDetailsViewProps) {
  const receiptImageUrl = redemption.receiptImageUrl || redemption.receiptThumbnailUrl;
  const initials = redemption.userName
    .split(" ")
    .filter(Boolean)
    .map((name) => name[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const infoRows = [
    { label: "Receipt ID", value: redemption.receiptId },
    { label: "Store Name", value: redemption.receiptMerchant },
    {
      label: "Purchase Date",
      value: redemption.receiptPurchasedAt
        ? `${redemption.submittedDate}, ${redemption.submittedTime}`
        : undefined,
    },
    { label: "Receipt Total", value: redemption.receiptTotal },
    { label: "Reward Amount", value: redemption.claimedTierValue },
  ].filter((row) => hasValue(row.value));

  return (
    <div className="flex flex-col gap-6 w-full animate-slide-up text-left font-manrope">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="bg-transparent border-none cursor-pointer text-xl font-bold text-[#131B2E] hover:text-[#001BD2] flex items-center gap-2"
        >
          <span>&larr;</span> Redemption Details
        </button>
      </div>

      <div className="bg-white border border-[#C5C5D9]/15 shadow-sm rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full relative overflow-hidden border-l-[6px] border-l-[#001BD2]">
        <div className="flex flex-col text-left min-w-0">
          <h2 className="font-jakarta font-extrabold text-2xl text-[#131B2E] break-all">
            Redemption #{redemption.id}
          </h2>
          {hasValue(redemption.campaignName) && (
            <span className="font-medium text-[#454656] text-sm mt-1">
              Campaign: {redemption.campaignName}
            </span>
          )}
        </div>
        <span
          className={`px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 uppercase tracking-wider ${
            redemption.status === "Approved"
              ? "bg-[#E8F8F0] text-[#137333]"
              : redemption.status === "Rejected"
                ? "bg-[#FDF2F2] text-[#BA1A1A]"
                : "bg-[#FFFBEB] text-[#D97706]"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              redemption.status === "Approved"
                ? "bg-[#137333]"
                : redemption.status === "Rejected"
                  ? "bg-[#BA1A1A]"
                  : "bg-[#D97706]"
            }`}
          />
          Status: {redemption.status}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start w-full">
        <div className="bg-white border border-[#C5C5D9]/15 shadow-sm rounded-3xl p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center gap-4">
            <span className="text-[10px] font-extrabold text-[#454656]/60 uppercase tracking-widest">
              Evidence Section
            </span>
            {hasValue(receiptImageUrl) && (
              <a
                href={receiptImageUrl}
                target="_blank"
                className="text-xs font-bold text-[#001BD2] no-underline hover:underline"
              >
                VIEW FULL
              </a>
            )}
          </div>
          <div className="bg-[#EEF0FF] rounded-2xl p-6 flex items-center justify-center border border-slate-100 min-h-[440px]">
            <img
              src={receiptImageUrl}
              alt="Receipt Scan"
              className="max-h-[560px] max-w-full shadow-lg rounded object-contain"
            />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-white border border-[#C5C5D9]/15 shadow-sm rounded-3xl p-6 flex flex-col gap-4">
            <span className="text-[10px] font-extrabold text-[#454656]/60 uppercase tracking-widest">
              Customer Profile
            </span>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-[#001BD2] text-white font-extrabold text-sm flex items-center justify-center flex-shrink-0">
                {redemption.userAvatar ? (
                  <img
                    src={redemption.userAvatar}
                    alt={redemption.userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initials || "U"
                )}
              </div>
              <div className="flex flex-col text-left min-w-0">
                {hasValue(redemption.userName) && (
                  <span className="font-bold text-[#131B2E] text-base truncate">
                    {redemption.userName}
                  </span>
                )}
                {hasValue(redemption.userEmail) && (
                  <span className="text-xs text-[#454656]/70 mt-0.5 truncate">
                    {redemption.userEmail}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-[#C5C5D9]/10 pt-4 mt-2">
              <div className="flex flex-col items-center">
                <span className="font-jakarta font-extrabold text-lg text-[#131B2E]">
                  {redemption.redemptionsCount}
                </span>
                <span className="text-[9px] font-extrabold text-[#454656]/50 uppercase tracking-wider mt-1">
                  Redemptions
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-jakarta font-extrabold text-lg text-[#131B2E]">
                  {redemption.reviewsCount}
                </span>
                <span className="text-[9px] font-extrabold text-[#454656]/50 uppercase tracking-wider mt-1">
                  Reviews
                </span>
              </div>
            </div>
          </div>

          {infoRows.length > 0 && (
            <div className="bg-white border border-[#C5C5D9]/15 shadow-sm rounded-3xl p-6 flex flex-col gap-4">
              <span className="text-[10px] font-extrabold text-[#454656]/60 uppercase tracking-widest">
                Receipt Details
              </span>
              <div className="grid grid-cols-1 gap-3">
                {infoRows.map((row) => (
                  <div
                    key={row.label}
                    className="bg-[#F8F9FF] border border-[#C5C5D9]/15 rounded-xl p-4 flex flex-col gap-1"
                  >
                    <span className="text-[10px] font-bold text-[#454656]/60 uppercase tracking-wider">
                      {row.label}
                    </span>
                    <span className="text-sm font-bold text-[#131B2E] break-words">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
