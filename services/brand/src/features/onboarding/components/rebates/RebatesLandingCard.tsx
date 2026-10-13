/* eslint-disable @next/next/no-img-element */
import { CalendarDays, ImageIcon, Info, Pencil } from "lucide-react";
import NibblReviewComment from "./NibblReviewComment";
import { formatMoney } from "../../utils/backendMappers";

export type RebateTab =
  | "Draft"
  | "Pending Review"
  | "Scheduled"
  | "Active"
  | "Paused"
  | "Changes Requested"
  | "Ended";

export interface RebateCampaignCard {
  id: string;
  tab: RebateTab;
  statusLabel: string;
  headline: string;
  description: string;
  image: string;
  dates: string;
  claims: number;
  activeClaims: number;
  pendingReview: number;
  redemptions: number;
  redemptionRate: number | null;
  rewardSpend: number;
  cycleClaims: number;
  capacity: number;
  // Same rule as the campaign page: no edits while in review, rejected or ended.
  canEdit: boolean;
  // Nibbl comment when changes were requested or the campaign was rejected.
  reviewComment?: string;
}

const PILL: Record<RebateTab, string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Scheduled: "bg-[#E2E7FF] text-[#001BD2]",
  Paused: "bg-amber-50 text-amber-700",
  "Pending Review": "bg-amber-50 text-amber-700",
  "Changes Requested": "bg-red-50 text-red-700",
  Draft: "bg-slate-100 text-slate-600",
  Ended: "bg-slate-100 text-slate-500",
};
const DOT: Record<RebateTab, string> = {
  Active: "bg-emerald-500",
  Scheduled: "bg-[#001BD2]",
  Paused: "bg-amber-500",
  "Pending Review": "bg-amber-500",
  "Changes Requested": "bg-red-500",
  Draft: "bg-slate-400",
  Ended: "bg-slate-400",
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5 px-3 py-2">
    <span className="text-[11px] text-[#64748B]">{label}</span>
    <span className="text-base font-extrabold text-[#131B2E]">{value}</span>
  </div>
);

/** Master Rebate Campaigns card: image, results, current-cycle claims. */
export default function RebatesLandingCard({
  campaign,
  onView,
  onEdit,
}: {
  campaign: RebateCampaignCard;
  onView: () => void;
  onEdit: () => void;
}) {
  const ratio = campaign.capacity ? Math.min(1, campaign.cycleClaims / campaign.capacity) : 0;
  const live = campaign.tab === "Active";

  return (
    <div className="bg-white border border-[#C5C5D9]/20 rounded-[20px] p-4 flex flex-col gap-3 shadow-sm font-manrope">
      <div className="relative h-44 rounded-2xl bg-[#F2F3FF] overflow-hidden flex items-center justify-center">
        {campaign.image ? (
          <img src={campaign.image} alt="" className="h-full w-full object-contain" />
        ) : (
          <ImageIcon className="w-10 h-10 text-[#C5C5D9]" />
        )}
        <span className={`absolute left-3 top-3 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center gap-1.5 ${PILL[campaign.tab]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${DOT[campaign.tab]}`} />
          {campaign.statusLabel}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold font-jakarta text-[#131B2E] leading-snug">{campaign.headline}</h3>
        {campaign.description && <p className="text-sm text-[#454656] line-clamp-2">{campaign.description}</p>}
        <span className="flex items-center gap-1.5 text-xs text-[#64748B] mt-1">
          <CalendarDays className="w-3.5 h-3.5" /> {campaign.dates}
        </span>
        <NibblReviewComment comment={campaign.reviewComment} compact />
      </div>

      <div className="grid grid-cols-3 border border-[#EAEDFF] rounded-xl divide-x divide-[#EAEDFF]">
        <Metric label="Claims" value={String(campaign.claims)} />
        <Metric label="Active Claims" value={String(campaign.activeClaims)} />
        <Metric label="Pending Review" value={String(campaign.pendingReview)} />
      </div>
      <div className="grid grid-cols-3 border border-[#EAEDFF] rounded-xl divide-x divide-[#EAEDFF] -mt-1">
        <Metric label="Redemptions" value={String(campaign.redemptions)} />
        <Metric
          label="Redemption Rate"
          value={campaign.redemptionRate === null ? "—" : `${campaign.redemptionRate.toFixed(1)}%`}
        />
        <Metric label="Reward Spend" value={formatMoney(campaign.rewardSpend)} />
      </div>

      <div className="flex items-center gap-3 text-sm text-[#454656]">
        <span className="whitespace-nowrap">
          Current Cycle Claims: <b className="text-[#131B2E]">{campaign.cycleClaims} of {campaign.capacity || "—"}</b>
        </span>
        <span className="flex-1 h-2 bg-[#EAEDFF] rounded-full overflow-hidden">
          <span
            className={`block h-full rounded-full ${live ? "bg-[#001BD2]" : "bg-slate-300"}`}
            style={{ width: `${ratio * 100}%` }}
          />
        </span>
      </div>

      <p className="flex items-center gap-2 rounded-xl bg-[#F2F3FF] px-3 py-2 text-[11px] text-[#454656]">
        <Info className="w-3.5 h-3.5 text-[#001BD2] flex-shrink-0" />
        Higher redemption rates can improve visibility in Nibbl discovery.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onEdit}
          disabled={!campaign.canEdit}
          title={campaign.canEdit ? "" : "This campaign can't be edited right now"}
          className="h-11 rounded-xl bg-[#F2F3FF] text-[#001BD2] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Pencil className="w-4 h-4" /> Edit Campaign
        </button>
        <button
          type="button"
          onClick={onView}
          className="h-11 rounded-xl bg-[#001BD2] text-white text-sm font-bold cursor-pointer"
        >
          View Details
        </button>
      </div>
    </div>
  );
}
