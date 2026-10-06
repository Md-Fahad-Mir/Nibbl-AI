/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatInteger, formatMoney, toNumber } from "../../utils/backendMappers";

interface CampaignItem {
  id: string;
  name: string;
  createdDate: string;
  status: "Active" | "Paused";
  reviews: number;
  todayReviews: number;
  spend: number;
}

interface ReviewsLandingProps {
  campaigns: CampaignItem[];
  onCreateNew: () => void;
  onViewDetail: (camp: CampaignItem) => void;
  onReviewManagement: () => void;
}

export default function ReviewsLanding({ campaigns, onCreateNew, onViewDetail, onReviewManagement }: ReviewsLandingProps) {
  const [page, setPage] = useState(1);
  const analyticsOverview = useBrandApiStore((state) => state.analyticsOverview);
  const spend = (analyticsOverview?.spend || {}) as Record<string, unknown>;
  const totalReviews = toNumber(analyticsOverview?.reviews);
  const reviewSpend = toNumber(spend.review_reward) + toNumber(spend.review_fee);
  const costPerReview = totalReviews ? reviewSpend / totalReviews : 0;
  const dailyBudget = campaigns.reduce((sum, campaign) => sum + campaign.spend, 0);
  const itemsPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(campaigns.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * itemsPerPage;
  const paginatedCampaigns = campaigns.slice(pageStart, pageStart + itemsPerPage);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left font-manrope">
      
      {/* Hero Header Section */}
      <div className="flex justify-between items-end w-full border-b border-slate-100 pb-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span>Reviews</span>
            <span>➔</span>
            <span className="text-[#001BD2]">Review Performance</span>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">Review Performance</h2>
            <span className="bg-emerald-100 text-[#15803D] text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></span>
              ACTIVE
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium max-w-[600px] mt-1 leading-relaxed">
            Optimize and monitor your review acquisition workflows, track daily budgets, and oversee verified user feedback.
          </p>
        </div>

        {/* Header CTA Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onReviewManagement}
            className="px-6 h-[46px] bg-[#E2E7FF] hover:bg-blue-100 text-[#001BD2] font-bold text-sm rounded-full transition-all cursor-pointer flex items-center gap-2 border-none"
          >
            <img src="/reviews/reviewManagementIcon.svg" alt="Management" className="w-[18px] h-[18px] object-contain" /> Review Management
          </button>
          <button
            onClick={onCreateNew}
            className="px-6 h-[46px] bg-[#001BD2] hover:bg-blue-700 text-white font-bold text-sm rounded-full transition-all shadow-md shadow-blue-500/10 cursor-pointer flex items-center gap-2 border-none"
          >
            <span>➕</span> Create Review Campaign
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 w-full">
        {/* Card 1 */}
        <div className="bg-white border border-[#C5C5D9]/10 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-[120px] relative">
          <div className="flex justify-between items-center w-full">
            <span className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <img src="/reviews/reviewCampains.svg" alt="Campaigns" className="w-5 h-5 object-contain" />
            </span>
            <span className="bg-[#E2E7FF] text-[#001BD2] text-[9px] font-bold px-2 py-0.5 rounded-full">ACTIVE</span>
          </div>
          <div className="flex flex-col gap-0.5 mt-2">
            <span className="text-[22px] font-extrabold text-[#131B2E]">{formatInteger(campaigns.length)}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">REVIEW CAMPAIGNS</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-[#C5C5D9]/10 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-[120px]">
          <span className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center">
            <img src="/reviews/dailyBudget.svg" alt="Budget" className="w-5 h-5 object-contain" />
          </span>
          <div className="flex flex-col gap-0.5 mt-2">
            <span className="text-[22px] font-extrabold text-[#131B2E]">{formatMoney(dailyBudget)}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DAILY BUDGET</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-[#C5C5D9]/10 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-[120px]">
          <span className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
            <img src="/reviews/TotalReviews.svg" alt="Total reviews" className="w-5 h-5 object-contain" />
          </span>
          <div className="flex flex-col gap-0.5 mt-2">
            <span className="text-[22px] font-extrabold text-[#131B2E]">{formatInteger(totalReviews)}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL REVIEWS (30D)</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white border border-[#C5C5D9]/10 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-[120px]">
          <span className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
            <img src="/reviews/ReviewSpend.svg" alt="Spend" className="w-5 h-5 object-contain" />
          </span>
          <div className="flex flex-col gap-0.5 mt-2">
            <span className="text-[22px] font-extrabold text-[#131B2E]">{formatMoney(reviewSpend)}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">REVIEW SPEND</span>
          </div>
        </div>

        {/* Card 5 */}
        <div className="bg-white border border-[#C5C5D9]/10 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-[120px]">
          <span className="w-8 h-8 rounded-xl bg-cyan-50 flex items-center justify-center">
            <img src="/reviews/CostperReview.svg" alt="Cost" className="w-5 h-5 object-contain" />
          </span>
          <div className="flex flex-col gap-0.5 mt-2">
            <span className="text-[22px] font-extrabold text-[#131B2E]">{formatMoney(costPerReview)}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">COST PER REVIEW</span>
          </div>
        </div>
      </div>

      {/* Description text */}
      <span className="text-[10px] text-slate-400 font-bold tracking-wide -mt-2">
        ℹ️ All activity is based on verified purchases from submitted receipts.
      </span>

      {/* Table grid */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col gap-4 w-full">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-[#131B2E] flex items-center gap-2">
            <img src="/reviews/ActiveCampains.svg" alt="Active Campaigns" className="w-5 h-5 object-contain" /> Active Campaigns
          </span>
        </div>

        <div className="w-full overflow-hidden border border-slate-100 rounded-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 h-12 text-slate-500 font-bold border-b border-slate-100">
                <th className="px-6 uppercase tracking-wider">CAMPAIGN NAME</th>
                <th className="px-6 uppercase tracking-wider">STATUS</th>
                <th className="px-6 uppercase tracking-wider">TOTAL REVIEWS</th>
                <th className="px-6 uppercase tracking-wider">SPEND</th>
                <th className="px-6 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCampaigns.map((camp) => (
                <tr
                  key={camp.id}
                  onClick={() => onViewDetail(camp)}
                  className="h-16 border-b border-slate-50 hover:bg-slate-50/50 transition-colors font-semibold text-[#131B2E] cursor-pointer"
                >
                  <td className="px-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-[#131B2E]">{camp.name}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Created {camp.createdDate}</span>
                    </div>
                  </td>
                  <td className="px-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 w-fit ${
                      camp.status === "Active" ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${camp.status === "Active" ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                      {camp.status}
                    </span>
                  </td>
                  <td className="px-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold">{camp.reviews}</span>
                      {camp.todayReviews > 0 && (
                        <span className="text-[9px] text-emerald-600 font-bold">+{camp.todayReviews} today</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 text-sm font-bold">${camp.spend.toFixed(2)}</td>
                  <td className="px-6 text-right">
                    <button className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                      <img src="/reviews/editIcon.svg" alt="Edit" className="w-[18px] h-[18px] object-contain inline" />
                    </button>
                    <button className="text-slate-400 hover:text-slate-600 p-1 ml-2 cursor-pointer">•••</button>
                  </td>
                </tr>
              ))}
              {paginatedCampaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">
                    No review data is available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center px-2 pt-2 font-manrope">
          <span className="text-xs font-semibold text-[#454656]">
            Showing {paginatedCampaigns.length ? pageStart + 1 : 0} -{" "}
            {Math.min(pageStart + paginatedCampaigns.length, campaigns.length)} of{" "}
            {campaigns.length} items
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
      
    </div>
  );
}
