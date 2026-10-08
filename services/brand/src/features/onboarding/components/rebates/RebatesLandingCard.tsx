import { Pencil } from "lucide-react";
import NibblReviewComment from "./NibblReviewComment";

interface Campaign {
  id: string;
  name: string;
  category: string;
  scope: string;
  cycleClaims: number;
  capacity: number;
  redemptions: number;
  rewardSpend: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "IN_REVIEW";
  // Nibbl approval label, e.g. "Pending review" (rebate campaigns).
  reviewLabel?: string;
  // Nibbl comment when changes were requested or the campaign was rejected.
  reviewComment?: string;
}

interface RebatesLandingCardProps {
  campaign: Campaign;
  onEdit: (camp: Campaign) => void;
}

export default function RebatesLandingCard({ campaign, onEdit }: RebatesLandingCardProps) {
  const cycleRatio = campaign.capacity ? campaign.cycleClaims / campaign.capacity : 0;
  const isNearLimit = cycleRatio >= 0.8; // "Going fast" threshold
  const isPaused = campaign.status === "PAUSED";
  const isCompleted = campaign.status === "COMPLETED";
  const inReview = campaign.status === "IN_REVIEW";

  const progressBg = isPaused || isCompleted || inReview
    ? "bg-slate-200"
    : isNearLimit
      ? "bg-[#BA1A1A]"
      : "bg-[#001BD2]";

  return (
    <div className="bg-white border border-[#C5C5D9]/10 rounded-[20px] p-6 flex flex-col justify-between min-h-[230px] font-jakarta shadow-sm hover:shadow-md transition-shadow relative">
      {/* Top Header Row */}
      <div className="flex justify-between items-start w-full">
        <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase flex items-center gap-1 ${
          inReview
            ? "bg-amber-50 text-amber-700"
            : isPaused
            ? "bg-slate-100 text-slate-500"
            : isCompleted
              ? "bg-[#FEF2F2] text-[#DC2626]"
              : "bg-[#E2E7FF] text-[#001BD2]"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            inReview
              ? "bg-amber-500"
              : isPaused
              ? "bg-slate-400"
              : isCompleted
                ? "bg-[#DC2626]"
                : "bg-[#001BD2]"
          }`}></span>
          {campaign.reviewLabel ?? campaign.status.replace("_", " ")}
        </span>
        {/* Edit Circular Action Button */}
        <button
          onClick={() => onEdit(campaign)}
          className="w-8 h-8 rounded-full bg-[#001BD2] hover:bg-blue-700 transition-colors flex items-center justify-center shadow-md active:scale-95 cursor-pointer"
          aria-label="View campaign"
        >
          <Pencil className="w-3.5 h-3.5 text-white" strokeWidth={2.4} />
        </button>
      </div>

      {/* Campaign Info */}
      <div className="flex flex-col gap-1 mt-4">
        <h3 className="text-lg font-bold text-[#131B2E] tracking-tight">{campaign.name}</h3>
        <span className="text-xs text-[#64748B] font-medium leading-none">
          {campaign.category} • {campaign.scope}
        </span>
        <NibblReviewComment comment={campaign.reviewComment} compact />
      </div>

      {/* Grid boxes info */}
      <div className="grid grid-cols-2 gap-4 mt-4 font-manrope">
        <div className="bg-[#FAF8FF] p-3 rounded-xl border border-[#C5C5D9]/5 flex flex-col gap-0.5">
          <span className="text-[9px] font-bold text-[#454656]/50 uppercase tracking-wider">REDEMPTIONS</span>
          <span className="text-sm font-extrabold text-[#131B2E]">{campaign.redemptions}</span>
        </div>
        <div className="bg-[#FAF8FF] p-3 rounded-xl border border-[#C5C5D9]/5 flex flex-col gap-0.5">
          <span className="text-[9px] font-bold text-[#454656]/50 uppercase tracking-wider">REWARD SPEND</span>
          <span className="text-sm font-extrabold text-[#131B2E]">${campaign.rewardSpend.toFixed(2)}</span>
        </div>
      </div>

      {/* Current 25-hour cycle claims */}
      <div className="flex flex-col gap-1.5 mt-4 font-manrope">
        <div className="flex justify-between items-center text-[10px] font-bold text-[#454656]">
          <span>CURRENT CYCLE CLAIMS</span>
          <span className="text-[#131B2E]">
            {campaign.cycleClaims} of {campaign.capacity || "—"}
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
          <div
            className={`absolute left-0 top-0 bottom-0 rounded-full transition-all duration-300 ${progressBg}`}
            style={{ width: `${Math.min(cycleRatio * 100, 100)}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
