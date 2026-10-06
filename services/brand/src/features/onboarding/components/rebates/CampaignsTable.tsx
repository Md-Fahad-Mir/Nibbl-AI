/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import { ApiRecord, backendAssetUrl } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatInteger, formatMoney, titleCase, toNumber } from "../../utils/backendMappers";

type CampaignTypeFilter = "All Types" | "Rebate" | "Review";
type CampaignDateFilter = "Last 30 Days" | "Last 90 Days" | "All Time";

type DashboardCampaign = {
  id: string;
  name: string;
  type: "REBATE" | "REVIEW";
  status: string;
  isActive: boolean;
  spend: number;
  activity: string;
  activitySub: string;
  thumbnail: string;
  timestamp: number | null;
};

const campaignId = (campaign: ApiRecord) =>
  String(campaign.id ?? campaign.campaign_id ?? "");

const campaignStatusValue = (campaign: ApiRecord) => {
  const rawStatus =
    campaign.status ??
    campaign.lifecycle_status ??
    campaign.state ??
    campaign.campaign_status;

  if (typeof rawStatus === "string" && rawStatus.trim()) return rawStatus;
  if (campaign.is_active === true || campaign.active === true) return "active";
  if (campaign.is_active === false || campaign.active === false) return "paused";

  return "draft";
};

const statusText = (campaign: ApiRecord) => titleCase(campaignStatusValue(campaign));

const isActiveCampaign = (campaign: ApiRecord) =>
  campaignStatusValue(campaign).trim().toLowerCase() === "active" ||
  campaign.is_active === true ||
  campaign.active === true;

const campaignTimestamp = (campaign: ApiRecord) => {
  const rawDate =
    campaign.created_at ??
    campaign.start_at ??
    campaign.updated_at ??
    campaign.createdAt ??
    campaign.startAt ??
    campaign.created ??
    campaign.launched_at ??
    campaign.activated_at;
  if (typeof rawDate !== "string" || !rawDate) return null;
  const timestamp = new Date(rawDate).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const campaignProducts = (campaign: ApiRecord) => {
  const rawProducts =
    campaign.products ??
    campaign.product ??
    campaign.product_ids ??
    campaign.product_id;
  if (Array.isArray(rawProducts)) return rawProducts;
  return rawProducts ? [rawProducts] : [];
};

const campaignProductIds = (campaign: ApiRecord) =>
  campaignProducts(campaign)
    .map((product) =>
      product && typeof product === "object"
        ? String((product as ApiRecord).id ?? (product as ApiRecord).product_id ?? "")
        : String(product)
    )
    .filter(Boolean);

const inlineProductImage = (campaign: ApiRecord) => {
  const productWithImage = campaignProducts(campaign).find(
    (product): product is ApiRecord =>
      Boolean(product) &&
      typeof product === "object" &&
      (typeof (product as ApiRecord).image_url === "string" ||
        typeof (product as ApiRecord).image === "string")
  );
  return productWithImage
    ? backendAssetUrl(productWithImage.image_url ?? productWithImage.image, "")
    : "";
};

export default function CampaignsTable() {
  const [typeFilter, setTypeFilter] = useState<CampaignTypeFilter>("All Types");
  const [dateFilter, setDateFilter] = useState<CampaignDateFilter>("Last 30 Days");
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [page, setPage] = useState(1);
  const campaigns = useBrandApiStore((state) => state.campaigns);
  const reviewCampaigns = useBrandApiStore((state) => state.reviewCampaigns);
  const analyticsCampaigns = useBrandApiStore((state) => state.analyticsCampaigns);
  const products = useBrandApiStore((state) => state.products);
  const [now] = useState(() => Date.now());

  const rows: DashboardCampaign[] = useMemo(() => {
    const analyticsByCampaign = new Map(
      analyticsCampaigns.map((row) => [String(row.campaign_id), row])
    );
    const productImageById = new Map(
      products.map((product) => [product.id, product.imageSrc])
    );
    const thumbnailForCampaign = (campaign: ApiRecord, fallback: string) => {
      const inlineImage = inlineProductImage(campaign);
      if (inlineImage) return inlineImage;

      const productId = campaignProductIds(campaign).find((id) =>
        productImageById.has(id)
      );
      return productId ? productImageById.get(productId) || fallback : fallback;
    };

    return [
      ...campaigns.map((campaign) => {
        const metrics = analyticsByCampaign.get(campaignId(campaign));
        const redemptions = toNumber(metrics?.redemptions);
        const approvals = toNumber(metrics?.approvals);
        return {
          id: campaignId(campaign),
          name: String(campaign.name ?? "Untitled rebate campaign"),
          type: "REBATE" as const,
          status: statusText(campaign),
          isActive: isActiveCampaign(campaign),
          spend: toNumber(metrics?.total_spend),
          activity: `${formatInteger(approvals)} Purchases`,
          activitySub: `${formatInteger(redemptions)} Redemptions`,
          thumbnail: thumbnailForCampaign(campaign, "/Auth/rebateImage.svg"),
          timestamp: campaignTimestamp(campaign),
        };
      }),
      ...reviewCampaigns.map((campaign) => ({
        id: campaignId(campaign),
        name: String(campaign.name ?? "Untitled review campaign"),
        type: "REVIEW" as const,
        status: statusText(campaign),
        isActive: isActiveCampaign(campaign),
        spend: toNumber(campaign.daily_budget),
        activity: `${formatInteger(campaign.prompts instanceof Array ? campaign.prompts.length : 0)} Prompts`,
        activitySub: `${formatMoney(campaign.reward_amount)} Reward`,
        thumbnail: thumbnailForCampaign(campaign, "/Auth/reviewImage.svg"),
        timestamp: campaignTimestamp(campaign),
      })),
    ].filter((campaign) => campaign.id);
  }, [analyticsCampaigns, campaigns, products, reviewCampaigns]);

  const activeRows = useMemo(() => {
    const dateWindow =
      dateFilter === "Last 30 Days"
        ? 30 * 24 * 60 * 60 * 1000
        : dateFilter === "Last 90 Days"
          ? 90 * 24 * 60 * 60 * 1000
          : null;

    return rows.filter((campaign) => {
      const matchesType =
        typeFilter === "All Types" || campaign.type === typeFilter.toUpperCase();
      const matchesDate =
        dateWindow === null ||
        campaign.timestamp === null ||
        campaign.timestamp >= now - dateWindow;

      return campaign.isActive && matchesType && matchesDate;
    });
  }, [dateFilter, now, rows, typeFilter]);

  const itemsPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * itemsPerPage;
  const visibleRows = activeRows.slice(pageStart, pageStart + itemsPerPage);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const typeOptions: CampaignTypeFilter[] = ["All Types", "Rebate", "Review"];
  const dateOptions: CampaignDateFilter[] = ["Last 30 Days", "Last 90 Days", "All Time"];

  const selectTypeFilter = (value: CampaignTypeFilter) => {
    setTypeFilter(value);
    setShowTypeFilter(false);
    setPage(1);
  };

  const selectDateFilter = (value: CampaignDateFilter) => {
    setDateFilter(value);
    setShowDateFilter(false);
    setPage(1);
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex justify-between items-center w-full">
        <h2 className="text-sm font-jakarta font-extrabold text-[#454656] opacity-70 tracking-widest uppercase">
          ACTIVE CAMPAIGNS
        </h2>

        {/* Dropdowns Filters */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowTypeFilter((value) => !value);
                setShowDateFilter(false);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#C5C5D9]/20 rounded-lg text-xs font-bold text-[#454656] cursor-pointer hover:bg-slate-50"
            >
              <span>{typeFilter}</span>
              <span className="text-[10px]">v</span>
            </button>
            {showTypeFilter && (
              <div className="absolute right-0 mt-2 w-36 bg-white border border-slate-200 shadow-lg rounded-xl py-1 z-30">
                {typeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => selectTypeFilter(option)}
                    className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 border-none bg-transparent cursor-pointer ${
                      typeFilter === option ? "text-[#001BD2]" : "text-[#131B2E]"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowDateFilter((value) => !value);
                setShowTypeFilter(false);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#C5C5D9]/20 rounded-lg text-xs font-bold text-[#454656] cursor-pointer hover:bg-slate-50"
            >
              <span>{dateFilter}</span>
              <span className="text-[10px]">v</span>
            </button>
            {showDateFilter && (
              <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 shadow-lg rounded-xl py-1 z-30">
                {dateOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => selectDateFilter(option)}
                    className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 border-none bg-transparent cursor-pointer ${
                      dateFilter === option ? "text-[#001BD2]" : "text-[#131B2E]"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table Container Card */}
      <div className="bg-white border border-[#C5C5D9]/10 rounded-2xl shadow-sm overflow-hidden flex flex-col w-full">
        <table className="w-full text-left border-collapse font-manrope">
          <thead>
            <tr className="bg-[#F2F3FF] h-[55px] text-[#454656] text-[11px] font-bold tracking-wider uppercase border-b border-[#C5C5D9]/5">
              <th className="px-8 font-bold">CAMPAIGN NAME</th>
              <th className="px-8 font-bold">TYPE</th>
              <th className="px-8 font-bold">STATUS</th>
              <th className="px-8 font-bold text-right">SPEND</th>
              <th className="px-8 font-bold text-right">ACTIVITY</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={`${row.type}-${row.id}`} className="h-[88.5px] border-b border-[#C5C5D9]/5 hover:bg-slate-50/50 transition-colors">
                <td className="px-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#EAEDFF] overflow-hidden flex items-center justify-center flex-shrink-0">
                      <img
                        src={row.thumbnail}
                        alt="Campaign thumbnail"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src =
                            row.type === "REBATE"
                              ? "/Auth/rebateImage.svg"
                              : "/Auth/reviewImage.svg";
                        }}
                        className="w-10 h-10 object-cover"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-[#131B2E]">
                        {row.name}
                      </span>
                      <span className="text-[10px] text-[#454656] mt-0.5">
                        ID: {row.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-8">
                  <span className={`${row.type === "REBATE" ? "bg-[#001BD2]/10 text-[#001BD2]" : "bg-[#004956]/10 text-[#004956]"} text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tight`}>
                    {row.type}
                  </span>
                </td>
                <td className="px-8">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 ${row.status === "Active" ? "bg-[#10B981]" : "bg-[#FBBF24]"} rounded-full`}></span>
                    <span className="text-xs font-semibold text-[#454656]">
                      {row.status}
                    </span>
                  </div>
                </td>
                <td className="px-8 text-right">
                  <span className="text-sm font-bold text-[#131B2E]">
                    {formatMoney(row.spend)}
                  </span>
                </td>
                <td className="px-8 text-right">
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-bold text-[#131B2E]">
                      {row.activity}
                    </span>
                    <span className="text-[10px] text-[#454656] mt-0.5">
                      {row.activitySub}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center text-sm font-semibold text-slate-400">
                  No active campaigns match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Table Footer */}
        <div className="flex justify-between items-center px-8 py-4 bg-[#F2F3FF] border-t border-[#C5C5D9]/5">
          <span className="text-[10px] font-manrope font-bold text-[#454656] tracking-wider uppercase">
            SHOWING {visibleRows.length ? pageStart + 1 : 0}-
            {Math.min(pageStart + visibleRows.length, activeRows.length)} OF {activeRows.length} ACTIVE CAMPAIGNS
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              &lt;
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold ${
                  currentPage === pageNumber
                    ? "bg-[#001BD2] text-white border-[#001BD2]"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
