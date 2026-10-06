/* eslint-disable @next/next/no-img-element */
"use client";

import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatInteger, formatMoney, toNumber } from "../../utils/backendMappers";

export default function ReviewSnapshot() {
  const analyticsOverview = useBrandApiStore((state) => state.analyticsOverview);
  const spend = (analyticsOverview?.spend || {}) as Record<string, unknown>;
  const totalReviews = toNumber(analyticsOverview?.reviews);
  const reviewSpend = toNumber(spend.review_reward) + toNumber(spend.review_fee);
  const costPerReview = totalReviews ? reviewSpend / totalReviews : 0;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex justify-between items-center w-full">
        <h2 className="text-sm font-jakarta font-extrabold text-[#454656] opacity-70 tracking-widest uppercase">
          REVIEW SNAPSHOT
        </h2>
        {/* Pagination Arrows */}
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-full border border-[#C5C5D9]/25 flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer text-slate-500 text-xs">
            ‹
          </button>
          <button className="w-8 h-8 rounded-full border border-[#C5C5D9]/25 flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer text-slate-500 text-xs">
            ›
          </button>
        </div>
      </div>

      {/* Grid 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Total Reviews */}
        <div className="bg-white border border-[#C5C5D9]/10 rounded-2xl p-8 flex items-center gap-6 h-[142.5px] shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#F2F3FF] flex items-center justify-center flex-shrink-0">
            <img
              src="/Dashboard/TotalReviws.svg"
              alt="Total Reviews"
              className="w-[25px] h-[23px] object-contain"
            />
          </div>
          <div className="flex flex-col font-manrope">
            <span className="text-[12px] font-bold text-[#454656] tracking-wider uppercase leading-none">
              TOTAL REVIEWS
            </span>
            <span className="text-3xl font-extrabold text-[#131B2E] mt-1.5 leading-none">
              {formatInteger(totalReviews)}
            </span>
            <span className="text-[11px] font-bold text-[#059669] flex items-center gap-1 mt-1 leading-none">
              <span>✓</span> 18% from last month
            </span>
          </div>
        </div>

        {/* Card 2: Review Spend */}
        <div className="bg-white border border-[#C5C5D9]/10 rounded-2xl p-8 flex items-center gap-6 h-[142.5px] shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#F2F3FF] flex items-center justify-center flex-shrink-0">
            <img
              src="/Dashboard/ReviewSpend.svg"
              alt="Review Spend"
              className="w-[25px] h-5 object-contain"
            />
          </div>
          <div className="flex flex-col font-manrope">
            <span className="text-[12px] font-bold text-[#454656] tracking-wider uppercase leading-none">
              REVIEW SPEND
            </span>
            <span className="text-3xl font-extrabold text-[#131B2E] mt-1.5 leading-none">
              {formatMoney(reviewSpend)}
            </span>
            <span className="text-[11px] font-medium text-[#454656] mt-1.5 leading-none">
              Budget utilization: 84%
            </span>
          </div>
        </div>

        {/* Card 3: Cost Per Review */}
        <div className="bg-white border border-[#C5C5D9]/10 rounded-2xl p-8 flex items-center gap-6 h-[142.5px] shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#F2F3FF] flex items-center justify-center flex-shrink-0">
            <img
              src="/Dashboard/CostPerReview.svg"
              alt="Cost Per Review"
              className="w-[22px] h-[22px] object-contain"
            />
          </div>
          <div className="flex flex-col font-manrope">
            <span className="text-[12px] font-bold text-[#454656] tracking-wider uppercase leading-none">
              COST PER REVIEW
            </span>
            <span className="text-3xl font-extrabold text-[#131B2E] mt-1.5 leading-none">
              {formatMoney(costPerReview)}
            </span>
            <span className="text-[11px] font-medium text-[#454656] mt-1.5 leading-none">
              Targeting: $4.50
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
