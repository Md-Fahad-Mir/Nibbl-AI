/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo } from "react";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatDate, formatInteger, formatMoney, toNumber } from "../../utils/backendMappers";

interface CampaignItem {
  id: string;
  name: string;
  createdDate: string;
  status: "Active" | "Paused";
  reviews: number;
  todayReviews: number;
  spend: number;
  productId?: string;
  productImageUrl?: string;
}

interface ReviewDetailsProps {
  campaign: CampaignItem;
  onBack: () => void;
}

export default function ReviewDetails({ campaign, onBack }: ReviewDetailsProps) {
  const apiReviews = useBrandApiStore((state) => state.reviews);
  const relatedReviews = useMemo(
    () =>
      apiReviews.filter((review) => {
        if (!campaign.productId) return String(review.product_name ?? "") === campaign.name;
        return String(review.product_id ?? review.product ?? "") === campaign.productId;
      }),
    [apiReviews, campaign.name, campaign.productId]
  );
  const averageRating =
    relatedReviews.length > 0
      ? relatedReviews.reduce((sum, review) => sum + toNumber(review.rating), 0) / relatedReviews.length
      : 0;
  const productImage =
    campaign.productImageUrl ||
    (typeof relatedReviews[0]?.product_image_url === "string"
      ? relatedReviews[0].product_image_url
      : "");

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left font-manrope">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <button onClick={onBack} className="hover:text-slate-600 cursor-pointer">Reviews</button>
        <span>/</span>
        <span className="text-[#131B2E]">Details: {campaign.name}</span>
      </div>

      <div className="flex justify-between items-center w-full pb-4 border-b border-slate-100">
        <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">
          {campaign.name}
        </h2>
        <button
          onClick={onBack}
          className="px-5 h-[38px] border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold text-xs rounded-xl transition-colors cursor-pointer"
        >
          Back to List
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start w-full">
        <div className="flex flex-col bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
          <div className="bg-[#F2F3FF] px-6 py-4 flex justify-between items-center border-b border-slate-100">
            <h3 className="text-sm font-bold text-[#131B2E]">Review Details</h3>
            {relatedReviews.length > 0 && (
              <span className="text-xs text-slate-400 font-bold">
                {formatInteger(relatedReviews.length)} reviews
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {relatedReviews.map((review) => {
              const rating = Math.round(toNumber(review.rating));
              const createdDate = formatDate(review.created_at);
              const content = String(review.content ?? "").trim();
              const authorName = String(review.author_name ?? "").trim();

              return (
                <article key={String(review.id)} className="p-6 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <img
                          key={i}
                          src="/reviews/star.svg"
                          alt="Star"
                          className={`w-4 h-4 object-contain ${i <= rating ? "" : "opacity-30"}`}
                        />
                      ))}
                    </div>
                    {createdDate && (
                      <span className="text-xs text-slate-400 font-semibold">
                        {createdDate}
                      </span>
                    )}
                  </div>
                  {content && (
                    <p className="text-sm font-medium text-[#131B2E] leading-relaxed">
                      &quot;{content}&quot;
                    </p>
                  )}
                  {authorName && (
                    <span className="text-xs font-bold text-[#454656]/70">
                      {authorName}
                    </span>
                  )}
                </article>
              );
            })}
            {relatedReviews.length === 0 && (
              <div className="p-10 text-sm font-semibold text-slate-400 text-center">
                No review details are available for this item.
              </div>
            )}
          </div>
        </div>

        <div className="w-full flex flex-col gap-6">
          {productImage && (
            <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm flex flex-col w-full">
              <div className="relative w-full h-[180px] bg-slate-50 border-b border-slate-100 flex items-center justify-center overflow-hidden">
                <img
                  src={productImage}
                  alt={campaign.name}
                  className="max-h-[85%] max-w-[85%] object-contain"
                />
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col gap-5 w-full text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Summary</span>
            <div className="flex justify-between items-center border-t border-slate-50 pt-4">
              <span className="text-xs text-slate-400 font-semibold">Average Rating</span>
              <span className="text-sm font-extrabold text-[#131B2E]">
                {averageRating ? averageRating.toFixed(1) : "N/A"}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-50 pt-4">
              <span className="text-xs text-slate-400 font-semibold">Total Reviews</span>
              <span className="text-sm font-extrabold text-[#131B2E]">
                {formatInteger(relatedReviews.length || campaign.reviews)}
              </span>
            </div>
            {campaign.spend > 0 && (
              <div className="flex justify-between items-center border-t border-slate-50 pt-4">
                <span className="text-xs text-slate-400 font-semibold">Daily Budget</span>
                <span className="text-sm font-extrabold text-[#001BD2]">
                  {formatMoney(campaign.spend)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
