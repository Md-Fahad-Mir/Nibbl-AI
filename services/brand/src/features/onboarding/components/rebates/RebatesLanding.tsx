import { useState } from "react";
import { Plus } from "lucide-react";
import RebatesLandingCard, { RebateCampaignCard, RebateTab } from "./RebatesLandingCard";
import CampaignLimitBanner from "./CampaignLimitBanner";
import Pager, { usePaged } from "@/components/shared/Pager";

const TABS: ("All" | RebateTab)[] = [
  "All",
  "Draft",
  "Pending Review",
  "Scheduled",
  "Active",
  "Paused",
  "Changes Requested",
  "Ended",
];

interface RebatesLandingProps {
  campaigns: RebateCampaignCard[];
  onCreateNew: () => void;
  onViewCampaign: (id: string) => void;
  onEditCampaign: (id: string) => void;
  onOpenPlans?: () => void;
}

/** Master Rebate Campaigns list: status tabs with counts and campaign cards. */
export default function RebatesLanding({
  campaigns,
  onCreateNew,
  onViewCampaign,
  onEditCampaign,
  onOpenPlans,
}: RebatesLandingProps) {
  const [filter, setFilter] = useState<"All" | RebateTab>("All");
  const filtered = filter === "All" ? campaigns : campaigns.filter((campaign) => campaign.tab === filter);
  const page = usePaged(filtered, 9, filter);
  const count = (tab: "All" | RebateTab) =>
    tab === "All" ? campaigns.length : campaigns.filter((campaign) => campaign.tab === tab).length;

  return (
    <div className="flex flex-col gap-6 w-full animate-slide-up">
      <div className="flex flex-wrap justify-between items-start gap-4 w-full">
        <div className="flex flex-col gap-1 text-left">
          <h1 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">Rebate Campaigns</h1>
          <p className="text-sm text-[#454656] font-manrope">
            Create and manage rebate campaigns to drive purchases and brand loyalty.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CampaignLimitBanner onOpenPlans={onOpenPlans} />
          <button
            onClick={onCreateNew}
            className="px-6 h-[46px] bg-[#001BD2] hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Rebate Campaign
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white border border-[#EAEDFF] rounded-2xl p-2 font-manrope">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`h-10 px-4 rounded-full text-sm font-semibold flex items-center gap-2 border cursor-pointer ${
              filter === tab
                ? "bg-[#001BD2] border-[#001BD2] text-white"
                : "bg-white border-[#EAEDFF] text-[#454656] hover:bg-slate-50"
            }`}
          >
            {tab}
            <span
              className={`min-w-6 h-6 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${
                filter === tab ? "bg-white/25 text-white" : "bg-[#F2F3FF] text-[#454656]"
              }`}
            >
              {count(tab)}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-[#C5C5D9]/10 rounded-[20px] p-12 text-center text-sm font-medium text-slate-400 w-full">
          {filter === "All" ? "No rebate campaigns yet." : `No ${filter.toLowerCase()} campaigns.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
          {page.items.map((campaign) => (
            <RebatesLandingCard
              key={campaign.id}
              campaign={campaign}
              onView={() => onViewCampaign(campaign.id)}
              onEdit={() => onEditCampaign(campaign.id)}
            />
          ))}
        </div>
      )}
      <Pager paged={page} noun="campaigns" className="w-full" />
    </div>
  );
}
