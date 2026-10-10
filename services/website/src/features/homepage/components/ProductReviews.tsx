"use client";

import { useEffect, useState } from "react";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
  { value: "helpful", label: "Most helpful" },
];

const Stars = ({ rating, size = "w-4 h-4" }: { rating: number; size?: string }) => (
  <div className="flex gap-[3px] items-center">
    {Array.from({ length: 5 }).map((_, i) => (
      <svg key={i} viewBox="0 0 20 20"
        className={`${size} fill-current ${i < Math.round(rating) ? "text-[#FFB701]" : "text-[#C0C0C0]"}`}>
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

const dateOnly = (value: unknown) =>
  typeof value === "string" && value
    ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

/** Master #27: reviews overview (rating, star distribution, recommendation
 *  rate, AI summary when available) and the sortable published reviews. */
export default function ProductReviews({ productId }: { productId: string }) {
  const [overview, setOverview] = useState<ApiRecord | null>(null);
  const [reviews, setReviews] = useState<ApiRecord[]>([]);
  const [sort, setSort] = useState("newest");
  const [helpful, setHelpful] = useState<Record<string, number>>({});

  useEffect(() => {
    let live = true;
    nibblApi.productReviewSummary(productId).then((data) => live && setOverview(data)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [productId]);

  useEffect(() => {
    let live = true;
    nibblApi
      .productReviews(productId, sort)
      .then((page) => live && setReviews(Array.isArray(page.results) ? page.results : []))
      .catch(() => live && setReviews([]));
    return () => {
      live = false;
    };
  }, [productId, sort]);

  const markHelpful = async (reviewId: string) => {
    try {
      const result = await nibblApi.markReviewHelpful(reviewId);
      setHelpful((prev) => ({ ...prev, [reviewId]: Number(result.helpful_count ?? 0) }));
    } catch {
      // Ignore: the count simply doesn't change.
    }
  };

  const count = Number(overview?.review_count ?? 0);
  const distribution = (overview?.star_distribution ?? {}) as Record<string, number>;
  const aiSummary = (overview?.ai_summary ?? null) as ApiRecord | null;

  return (
    <div className="w-full flex flex-col gap-6">
      {count > 0 && (
        <div className="w-full rounded-lg border border-gray-100 bg-white p-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-6 items-center">
            <div className="flex flex-col items-start gap-1">
              <span className="text-[32px] font-semibold leading-none text-[#1F1D1D]">
                {Number(overview?.rating ?? 0).toFixed(1)}
              </span>
              <Stars rating={Number(overview?.rating ?? 0)} />
              <span className="text-xs text-[#575757]">{count} verified review{count === 1 ? "" : "s"}</span>
            </div>
            <div className="flex-1 min-w-[180px] flex flex-col gap-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const n = Number(distribution[String(star)] ?? 0);
                return (
                  <div key={star} className="flex items-center gap-2 text-xs text-[#575757]">
                    <span className="w-6">{star}★</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#FFB701]" style={{ width: `${count ? (n * 100) / count : 0}%` }} />
                    </div>
                    <span className="w-6 text-right">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {overview?.recommendation_rate != null && (
            <p className="text-sm text-[#4D4D4D]">
              <b>{Number(overview.recommendation_rate).toFixed(0)}%</b> would buy again or recommend it.
            </p>
          )}
          {aiSummary?.summary ? (
            <div className="bg-[#F0F8FB] rounded-lg p-3 text-sm text-[#1F1D1D]">
              <span className="text-xs font-semibold text-[#3E3EDF] block mb-1">AI summary of reviews</span>
              {String(aiSummary.summary)}
            </div>
          ) : null}
        </div>
      )}

      {reviews.length > 0 && (
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="self-start border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1F1D1D] bg-white">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      )}

      {reviews.length ? reviews.map((review) => {
        const id = String(review.id);
        return (
          <div key={id} className="w-full flex flex-col gap-2 border-b border-gray-100 pb-5">
            <div className="w-full flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="text-[16px] font-medium text-[#1F1D1D]">
                  {String(review.display_name || "Verified shopper")}
                  {Boolean(review.verified_purchase) && (
                    <span className="ml-2 text-[11px] font-semibold text-[#00A671]">✓ Verified purchase</span>
                  )}
                </span>
                <Stars rating={Number(review.rating ?? 0)} />
              </div>
              <span className="text-[14px] text-[#4D4D4D] flex-shrink-0">
                {dateOnly(review.published_at ?? review.created_at)}
              </span>
            </div>
            {Boolean(review.title) && <p className="text-[16px] font-semibold text-[#1F1D1D]">{String(review.title)}</p>}
            <p className="text-[16px] leading-[22px] text-[#4D4D4D]">{String(review.content ?? "")}</p>
            {Boolean(review.disclosure) && <p className="text-xs text-[#8A8A8A]">{String(review.disclosure)}</p>}
            {Boolean(review.brand_response) && (
              <div className="ml-4 border-l-2 border-[#3E3EDF] pl-3 text-sm text-[#4D4D4D]">
                <span className="text-xs font-semibold text-[#3E3EDF] block">Response from the brand</span>
                {String(review.brand_response)}
              </div>
            )}
            <button onClick={() => void markHelpful(id)}
              className="self-start text-xs text-[#575757] border border-gray-200 rounded-full px-3 py-1 hover:bg-gray-50 cursor-pointer">
              Helpful ({helpful[id] ?? Number(review.helpful_count ?? 0)})
            </button>
          </div>
        );
      }) : (
        <div className="w-full rounded-lg border border-gray-100 bg-white p-4 text-sm text-[#575757]">
          No reviews yet for this product.
        </div>
      )}
    </div>
  );
}
