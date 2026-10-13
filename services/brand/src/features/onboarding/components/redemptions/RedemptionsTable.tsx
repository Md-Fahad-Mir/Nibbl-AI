"use client";

import { useMemo, useState } from "react";
import { Clock, Download, Info, Search } from "lucide-react";
import { ApiRecord } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import RedemptionRow from "./RedemptionRow";
import type { RedemptionItem } from "./types";

export type RedemptionTab = "All" | "Pending Review" | "Approved" | "Rejected" | "Expired";
export const REDEMPTION_TABS: RedemptionTab[] = ["All", "Pending Review", "Approved", "Rejected", "Expired"];

const STATUS_FOR_TAB: Record<Exclude<RedemptionTab, "All">, RedemptionItem["status"]> = {
  "Pending Review": "Manual Review",
  Approved: "Approved",
  Rejected: "Rejected",
  Expired: "Expired",
};

interface RedemptionsTableProps {
  redemptions: RedemptionItem[];
  activeTab: RedemptionTab;
  onTabChange: (tab: RedemptionTab) => void;
  onViewDetails: (item: RedemptionItem) => void;
  onExport: () => void;
}

const dateFilters = ["Last 7 Days", "Last 30 Days", "Last 90 Days", "All Time"] as const;
const DAYS: Record<string, number> = { "Last 7 Days": 7, "Last 30 Days": 30, "Last 90 Days": 90 };

const productIdsOf = (campaign: ApiRecord) =>
  (Array.isArray(campaign.products) ? campaign.products : Array.isArray(campaign.product_ids) ? campaign.product_ids : [])
    .map((p) => (p && typeof p === "object" ? String((p as ApiRecord).id ?? "") : String(p)))
    .filter(Boolean);

const filterClass =
  "h-10 px-3 bg-white border border-[#C5C5D9]/40 rounded-xl text-xs font-semibold text-[#131B2E] outline-none focus:border-[#001BD2]";
const label = "flex flex-col gap-1 text-[11px] font-semibold text-[#454656]";

/** Master Redemptions ②–⑥: status tabs, search and filters, priority queue,
 *  table, pagination and export. */
export default function RedemptionsTable({
  redemptions,
  activeTab,
  onTabChange,
  onViewDetails,
  onExport,
}: RedemptionsTableProps) {
  const [dateFilter, setDateFilter] = useState<(typeof dateFilters)[number]>("Last 30 Days");
  const [page, setPage] = useState(1);
  const [now] = useState(() => Date.now());
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const campaigns = useBrandApiStore((state) => state.campaigns);
  const products = useBrandApiStore((state) => state.products);

  const campaignNames = useMemo(
    () =>
      Array.from(
        new Set([...campaigns.map((c) => String(c.name ?? "")), ...redemptions.map((r) => r.campaignName)].filter(Boolean))
      ).sort(),
    [campaigns, redemptions]
  );

  const pending = redemptions.filter((r) => r.status === "Manual Review");
  const count = (tab: RedemptionTab) =>
    tab === "All" ? redemptions.length : redemptions.filter((r) => r.status === STATUS_FOR_TAB[tab]).length;

  const filtered = useMemo(() => {
    let next = activeTab === "All" ? redemptions : redemptions.filter((r) => r.status === STATUS_FOR_TAB[activeTab]);
    // Receipts awaiting review are never hidden by the date filter — each has
    // an auto-approval deadline the brand must act before.
    const days = DAYS[dateFilter];
    if (days) {
      next = next.filter((r) => {
        if (r.status === "Manual Review") return true;
        const timestamp = new Date(r.submittedAt || `${r.submittedDate} ${r.submittedTime}`).getTime();
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
        [r.userName, r.userEmail, r.campaignName, r.receiptMerchant ?? "", r.receiptId ?? ""].some((v) =>
          v.toLowerCase().includes(q)
        )
      );
    }
    // Oldest pending receipts first (Master: priority queue), then newest.
    return [...next].sort((a, b) => {
      const ap = a.status === "Manual Review";
      const bp = b.status === "Manual Review";
      if (ap !== bp) return ap ? -1 : 1;
      const at = new Date(a.submittedAt ?? 0).getTime();
      const bt = new Date(b.submittedAt ?? 0).getTime();
      return ap ? at - bt : bt - at;
    });
  }, [activeTab, campaignFilter, campaigns, dateFilter, now, productFilter, redemptions, search]);

  const perPage = 6;
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);
  const reset = () => setPage(1);
  const clearFilters = () => {
    setSearch("");
    setCampaignFilter("");
    setProductFilter("");
    setDateFilter("Last 30 Days");
    onTabChange("All");
    reset();
  };

  return (
    <div className="flex flex-col gap-4 w-full font-manrope">
      <div className="bg-white border border-[#EAEDFF] rounded-2xl p-3 flex flex-wrap gap-2">
        {REDEMPTION_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              onTabChange(tab);
              reset();
            }}
            className={`h-10 px-5 rounded-full text-sm font-semibold flex items-center gap-2 cursor-pointer ${
              activeTab === tab ? "bg-[#001BD2] text-white" : "bg-[#F2F3FF] text-[#454656] hover:bg-[#E2E7FF]"
            }`}
          >
            {tab}
            {tab === "Pending Review" && count(tab) > 0 && (
              <span className={`min-w-6 h-6 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${
                activeTab === tab ? "bg-white/25" : "bg-[#E2E7FF] text-[#001BD2]"
              }`}>
                {count(tab)}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#EAEDFF] rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 items-end">
        <label className={label}>
          <span className="sr-only">Search</span>
          <span className="relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                reset();
              }}
              placeholder="Search by customer, campaign, product or receipt ID…"
              className={`${filterClass} w-full pl-9`}
            />
          </span>
        </label>
        <label className={label}>
          Campaign
          <select value={campaignFilter} onChange={(e) => { setCampaignFilter(e.target.value); reset(); }} className={filterClass}>
            <option value="">All Campaigns</option>
            {campaignNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className={label}>
          Product
          <select value={productFilter} onChange={(e) => { setProductFilter(e.target.value); reset(); }} className={filterClass}>
            <option value="">All Products</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className={label}>
          Status
          <select value={activeTab} onChange={(e) => { onTabChange(e.target.value as RedemptionTab); reset(); }} className={filterClass}>
            {REDEMPTION_TABS.map((tab) => (
              <option key={tab} value={tab}>{tab === "All" ? "All Statuses" : tab}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Submitted Date
          <select value={dateFilter} onChange={(e) => { setDateFilter(e.target.value as (typeof dateFilters)[number]); reset(); }} className={filterClass}>
            {dateFilters.map((filter) => <option key={filter} value={filter}>{filter}</option>)}
          </select>
        </label>
        <button type="button" onClick={clearFilters} className="h-10 px-2 text-xs font-bold text-[#001BD2] cursor-pointer">
          Clear Filters
        </button>
      </div>

      {pending.length > 0 && (activeTab === "All" || activeTab === "Pending Review") && (
        <div className="bg-[#EEF0FF] border border-[#DAE2FD] rounded-2xl p-4 flex flex-wrap items-center gap-4">
          <Clock className="w-6 h-6 text-[#001BD2] flex-shrink-0" />
          <div className="flex-1 min-w-[240px]">
            <p className="text-sm font-bold text-[#131B2E]">Pending review queue ({pending.length})</p>
            <p className="text-xs text-[#454656]">
              Oldest first. Review within 7 days; otherwise the submission auto-approves using the campaign&apos;s
              maximum eligible reward. Auto-approval does not create or save a product alias.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#454656] max-w-[360px] border-l border-[#DAE2FD] pl-4">
            <Info className="w-4 h-4 text-[#001BD2] flex-shrink-0" />
            No brand decision by the 7-day deadline = customer auto-approved. The claim slot then releases. No mapping
            or alias is created.
          </div>
        </div>
      )}

      <div className="w-full bg-white border border-[#EAEDFF] shadow-sm rounded-[20px] overflow-hidden flex flex-col">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse min-w-[980px]">
            <thead>
              <tr className="border-b border-[#EAEDFF] bg-[#FAF8FF] text-[10px] font-bold tracking-wider text-[#454656] uppercase">
                <th className="p-4 text-left">Customer</th>
                <th className="p-4 text-left">Campaign</th>
                <th className="p-4 text-left">Submitted</th>
                <th className="p-4 text-left">Receipt Summary</th>
                <th className="p-4 text-left">Reward</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((redemption) => (
                <RedemptionRow key={redemption.id} redemption={redemption} onViewDetails={onViewDetails} />
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-sm font-semibold text-slate-400">
                    No redemptions match the current selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-[#EAEDFF] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-semibold text-[#454656]">
          <span>
            Showing {paginated.length > 0 ? (currentPage - 1) * perPage + 1 : 0}-
            {Math.min(currentPage * perPage, filtered.length)} of {filtered.length} results
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExport}
              className="h-8 px-3 mr-2 rounded-lg border border-[#C5C5D9]/40 bg-white text-[#001BD2] font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              className="w-8 h-8 rounded-full border border-[#C5C5D9]/20 flex items-center justify-center hover:bg-slate-50 cursor-pointer bg-white disabled:opacity-50"
            >
              &lt;
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
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
            ))}
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
