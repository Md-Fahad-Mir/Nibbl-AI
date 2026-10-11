/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import { ApiRecord } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import RedemptionRow from "./RedemptionRow";

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
  // Manual review: the raw queue item, its auto-approval deadline, and how
  // an approved redemption was decided.
  reviewItem?: Record<string, unknown>;
  deadlineAt?: string;
  approvalLabel?: string;
}

interface RedemptionsTableProps {
  redemptions: RedemptionItem[];
  onViewDetails: (item: RedemptionItem) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

type VisibleTab = "Approved" | "Rejected" | "Manual Review";

const dateFilters = ["Last 7 Days", "Last 30 Days", "Last 90 Days", "All Time"] as const;
const DAYS: Record<string, number> = { "Last 7 Days": 7, "Last 30 Days": 30, "Last 90 Days": 90 };

const productIdsOf = (campaign: ApiRecord) =>
  (Array.isArray(campaign.products) ? campaign.products : Array.isArray(campaign.product_ids) ? campaign.product_ids : [])
    .map((p) => (p && typeof p === "object" ? String((p as ApiRecord).id ?? "") : String(p)))
    .filter(Boolean);

const filterClass =
  "h-10 px-3 bg-white border border-[#C5C5D9]/30 rounded-xl text-xs font-semibold text-[#131B2E] outline-none focus:border-[#001BD2]";
const tabs: VisibleTab[] = ["Approved", "Rejected", "Manual Review"];

export default function RedemptionsTable({
  redemptions,
  onViewDetails,
  onApprove,
  onReject,
}: RedemptionsTableProps) {
  const [activeTab, setActiveTab] = useState<VisibleTab>("Approved");
  const [dateFilter, setDateFilter] = useState<(typeof dateFilters)[number]>(
    "Last 30 Days"
  );
  const [showDate, setShowDate] = useState(false);
  const [page, setPage] = useState(1);
  const [now] = useState(() => Date.now());
  // Master Redemptions ③: search + campaign, product, status and date filters.
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const campaigns = useBrandApiStore((state) => state.campaigns);
  const products = useBrandApiStore((state) => state.products);

  const campaignNames = useMemo(
    () => Array.from(new Set([
      ...campaigns.map((c) => String(c.name ?? "")),
      ...redemptions.map((r) => r.campaignName),
    ].filter(Boolean))).sort(),
    [campaigns, redemptions]
  );

  const filtered = useMemo(() => {
    let next = redemptions.filter((redemption) => redemption.status === activeTab);
    // Receipts awaiting review are never hidden by the date filter — each
    // one has an auto-approval deadline the brand must act before.
    const days = DAYS[dateFilter];
    if (days && activeTab !== "Manual Review") {
      next = next.filter((redemption) => {
        const source =
          redemption.submittedAt ||
          `${redemption.submittedDate} ${redemption.submittedTime}`;
        const timestamp = new Date(source).getTime();
        return Number.isNaN(timestamp) || timestamp >= now - days * 24 * 60 * 60 * 1000;
      });
    }
    if (campaignFilter) next = next.filter((r) => r.campaignName === campaignFilter);
    if (productFilter) {
      // A redemption belongs to a product through its campaign's eligible products.
      const names = new Set(
        campaigns.filter((c) => productIdsOf(c).includes(productFilter)).map((c) => String(c.name ?? ""))
      );
      next = next.filter((r) => names.has(r.campaignName));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      next = next.filter((r) =>
        [r.userName, r.userEmail, r.campaignName, r.receiptMerchant ?? ""].some((v) => v.toLowerCase().includes(q))
      );
    }
    return next;
  }, [activeTab, campaignFilter, campaigns, dateFilter, now, productFilter, redemptions, search]);

  const isManualReview = activeTab === "Manual Review";
  const title =
    activeTab === "Manual Review"
      ? "Manual Review Queue"
      : activeTab === "Rejected"
        ? "Rejected Receipts"
        : "Completed Redemptions";
  const itemsPerPage = 5;
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const selectTab = (tab: VisibleTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const selectDateFilter = (value: (typeof dateFilters)[number]) => {
    setDateFilter(value);
    setShowDate(false);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6 w-full font-manrope">
      <div className="bg-white border border-[#C5C5D9]/10 shadow-sm rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center w-full gap-4 relative">
        <div className="bg-[#F2F3FF] p-1 rounded-full flex items-center gap-1.5 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => selectTab(tab)}
              className={`px-5 py-2 text-xs font-bold rounded-full transition-all border-none cursor-pointer ${
                activeTab === tab
                  ? "bg-white text-[#001BD2] shadow-sm"
                  : "text-[#454656] hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowDate(!showDate)}
            className="bg-[#F2F3FF] px-4 py-2.5 rounded-full text-xs font-bold text-[#454656] flex items-center gap-2 border-none cursor-pointer"
          >
            <img src="/redemption/dateIcno.svg" alt="Date" className="w-[14px] h-[14px]" />
            {dateFilter}
            <span>v</span>
          </button>
          {showDate && (
            <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 shadow-lg rounded-xl py-1 z-30">
              {dateFilters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => selectDateFilter(filter)}
                  className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 border-none bg-transparent cursor-pointer text-[#131B2E]"
                >
                  {filter}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search customer, email, campaign or retailer…" className={filterClass} />
        <select value={campaignFilter} onChange={(e) => { setCampaignFilter(e.target.value); setPage(1); }}
          className={filterClass} aria-label="Campaign">
          <option value="">All Campaigns</option>
          {campaignNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select value={productFilter} onChange={(e) => { setProductFilter(e.target.value); setPage(1); }}
          className={filterClass} aria-label="Product">
          <option value="">All Products</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="w-full bg-white border border-[#C5C5D9]/10 shadow-sm rounded-[22px] overflow-hidden flex flex-col">
        <div className="bg-[#F2F3FF] px-8 py-4.5 flex justify-between items-center w-full border-b border-[#C5C5D9]/5">
          <h3 className="font-jakarta font-bold text-base text-[#131B2E]">
            {title}
          </h3>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#C5C5D9]/10 bg-[#FAF8FF]">
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">User</th>
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">Campaign</th>
                <th className={`p-5 text-[10px] font-bold tracking-wider text-[#454656] uppercase ${isManualReview ? "text-left" : "text-center"}`}>
                  {isManualReview ? "Issue" : "Receipt"}
                </th>
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">
                  {isManualReview ? "Submitted Date" : "Reward"}
                </th>
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">
                  {isManualReview ? "Actions" : "Submitted Date"}
                </th>
                {!isManualReview && (
                  <th className="p-5 text-right text-[10px] font-bold tracking-wider text-[#454656] uppercase">Status</th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginated.map((redemption) => (
                <RedemptionRow
                  key={redemption.id}
                  redemption={redemption}
                  isManualReviewTab={isManualReview}
                  onViewDetails={onViewDetails}
                  onApprove={onApprove}
                  onReject={onReject}
                />
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td
                    colSpan={isManualReview ? 5 : 6}
                    className="p-12 text-center text-sm font-semibold text-slate-400"
                  >
                    No redemptions match the current selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-8 py-5 border-t border-[#C5C5D9]/10 bg-[#F2F3FF]/30 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-bold text-[#454656] uppercase tracking-wider font-manrope">
          <span>
            Showing {paginated.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-
            {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} results
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              className="w-8 h-8 rounded-full border border-[#C5C5D9]/20 flex items-center justify-center hover:bg-slate-50 cursor-pointer bg-white disabled:opacity-50"
            >
              &lt;
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (pageNumber) => (
                <button
                  key={pageNumber}
                  onClick={() => setPage(pageNumber)}
                  className={`w-8 h-8 rounded-full font-bold flex items-center justify-center border cursor-pointer ${
                    currentPage === pageNumber
                      ? "bg-[#001BD2] text-white border-[#001BD2]"
                      : "bg-white text-[#131B2E] border-[#C5C5D9]/20 hover:bg-slate-50"
                  }`}
                >
                  {pageNumber}
                </button>
              )
            )}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="w-8 h-8 rounded-full border border-[#C5C5D9]/20 flex items-center justify-center hover:bg-slate-50 cursor-pointer bg-white disabled:opacity-50"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
