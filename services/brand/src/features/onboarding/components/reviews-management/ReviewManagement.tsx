"use client";

import { useEffect, useMemo, useState } from "react";
import ReviewKpiCard from "./ReviewKpiCard";
import ReviewRow from "./ReviewRow";
import { ApiRecord, backendAssetUrl } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import {
  formatDate,
  formatInteger,
  formatMoney,
  hasBackendValue,
  toNumber,
} from "../../utils/backendMappers";

type ReviewDateFilter = "All Time" | "Last 30 Days" | "Last 90 Days";

interface ReviewItem {
  id: string;
  customerName: string;
  customerEmail: string;
  customerAvatar?: string;
  productName: string;
  date: string;
  createdAt?: string;
  timestamp: number | null;
  rating: number;
  reward: string;
  status: "Approved" | "Pending Approval";
  reviewText: string;
  chatMessages: { id: string; sender: "assistant" | "shopper"; text: string }[];
}

interface ReviewManagementProps {
  onBack: () => void;
  initialProductFilter?: string;
}

const reviewDateFilters: ReviewDateFilter[] = ["All Time", "Last 30 Days", "Last 90 Days"];
const itemsPerPage = 5;

const reviewTimestamp = (value: unknown) => {
  if (typeof value !== "string" || !value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const mapChatMessages = (value: unknown): ReviewItem["chatMessages"] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as ApiRecord;
    const question = String(record.question ?? "").trim();
    const answer = String(record.answer ?? "").trim();
    return [
      question
        ? {
            id: `${index}-question`,
            sender: "assistant" as const,
            text: question,
          }
        : null,
      answer
        ? {
            id: `${index}-answer`,
            sender: "shopper" as const,
            text: answer,
          }
        : null,
    ].filter((message): message is ReviewItem["chatMessages"][number] => Boolean(message));
  });
};

const mapReview = (review: ApiRecord): ReviewItem => {
  const createdAt = typeof review.created_at === "string" ? review.created_at : undefined;
  const status = String(review.status ?? "").toLowerCase();
  const reward = review.reward_amount ?? review.reward ?? review.review_reward;
  const author =
    review.author_name ??
    review.customer_name ??
    review.user_name ??
    review.user_email ??
    "Customer";

  return {
    id: String(review.id),
    customerName: String(author),
    customerEmail: typeof review.user_email === "string" ? review.user_email : "",
    customerAvatar: backendAssetUrl(
      review.author_avatar ?? review.customer_avatar ?? review.user_avatar,
      ""
    ),
    productName: String(review.product_name ?? "Product"),
    date: formatDate(createdAt),
    createdAt,
    timestamp: reviewTimestamp(createdAt),
    rating: Math.max(0, Math.min(5, Math.round(toNumber(review.rating)))),
    reward: hasBackendValue(reward) ? formatMoney(reward) : "",
    status:
      status === "held" || status.includes("pending")
        ? "Pending Approval"
        : "Approved",
    reviewText: String(review.content ?? review.review_text ?? review.title ?? "").trim(),
    chatMessages: mapChatMessages(review.questions_and_answers),
  };
};

export default function ReviewManagement({ onBack, initialProductFilter }: ReviewManagementProps) {
  const [activeTab, setActiveTab] = useState<"All" | "Pending">("All");
  const [productFilter, setProductFilter] = useState(initialProductFilter || "All Products");

  const [dateFilter, setDateFilter] = useState<ReviewDateFilter>("All Time");
  const [activePage, setActivePage] = useState(1);
  const [localStatuses, setLocalStatuses] = useState<Record<string, ReviewItem["status"]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const apiReviews = useBrandApiStore((state) => state.reviews);
  const analyticsOverview = useBrandApiStore((state) => state.analyticsOverview);
  const spend = (analyticsOverview?.spend || {}) as Record<string, unknown>;
  const reviewSpend = toNumber(spend.review_reward) + toNumber(spend.review_fee);

  const reviews = useMemo(
    () =>
      apiReviews.map((review) => {
        const mapped = mapReview(review);
        return { ...mapped, status: localStatuses[mapped.id] || mapped.status };
      }),
    [apiReviews, localStatuses]
  );
  const totalReviews = Math.max(toNumber(analyticsOverview?.reviews), reviews.length);
  const productOptions = useMemo(
    () => ["All Products", ...Array.from(new Set(reviews.map((review) => review.productName))).sort()],
    [reviews]
  );
  const hasPendingReviews = reviews.some((review) => review.status === "Pending Approval");
  const showReward = reviews.some((review) => review.reward);
  const now = Date.now();

  const filtered = reviews.filter((review) => {
    const matchesTab = activeTab === "All" || review.status === "Pending Approval";
    const matchesProduct =
      productFilter === "All Products" || review.productName === productFilter;
    const dateWindow =
      dateFilter === "Last 30 Days"
        ? 30 * 24 * 60 * 60 * 1000
        : dateFilter === "Last 90 Days"
          ? 90 * 24 * 60 * 60 * 1000
          : null;
    const matchesDate =
      dateWindow === null ||
      review.timestamp === null ||
      review.timestamp >= now - dateWindow;
    return matchesTab && matchesProduct && matchesDate;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(activePage, totalPages);
  const pageStart = (currentPage - 1) * itemsPerPage;
  const paginatedReviews = filtered.slice(pageStart, pageStart + itemsPerPage);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  useEffect(() => {
    setActivePage(1);
  }, [activeTab, productFilter, dateFilter, apiReviews.length]);

  useEffect(() => {
    if (!hasPendingReviews && activeTab === "Pending") setActiveTab("All");
  }, [activeTab, hasPendingReviews]);

  const handleApprove = (id: string) => {
    setLocalStatuses((prev) => ({ ...prev, [id]: "Approved" }));
    setExpandedId(null);
  };

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left font-manrope bg-[#FAF8FF]">
      <button
        onClick={onBack}
        className="text-[#001BD2] font-bold text-sm hover:opacity-80 transition-all self-start cursor-pointer border-none bg-transparent"
      >
        Back
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end w-full gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">
            Reviews Management
          </h2>
          <p className="text-[#454656] text-sm md:text-base font-medium">
            Monitor verified product reviews returned by the reviews API.
          </p>
        </div>

        <div className="bg-[#F2F3FF] p-1 rounded-full flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setActiveTab("All")}
            className={`px-5 py-2 text-xs font-bold rounded-full transition-all border-none cursor-pointer ${
              activeTab === "All"
                ? "bg-white text-[#001BD2] shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
                : "text-[#454656] hover:text-slate-700"
            }`}
          >
            All Reviews
          </button>
          {hasPendingReviews && (
            <button
              onClick={() => setActiveTab("Pending")}
              className={`px-5 py-2 text-xs font-bold rounded-full transition-all border-none cursor-pointer ${
                activeTab === "Pending"
                  ? "bg-white text-[#001BD2] shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
                  : "text-[#454656] hover:text-slate-700"
              }`}
            >
              Pending Approval
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full mt-2">
        <ReviewKpiCard title="Total Reviews" value={formatInteger(totalReviews)} badgeText="Live" badgeType="green" iconPath="/reviews/TotalReviews.svg" iconBgColor="bg-[#001BD2]/5 text-[#001BD2]" />
        {reviewSpend > 0 && (
          <ReviewKpiCard title="Review Spend" value={formatMoney(reviewSpend)} badgeText="Lifetime" badgeType="gray" iconPath="/reviews/ReviewSpend.svg" iconBgColor="bg-[#004956]/5 text-[#004956]" />
        )}
        {reviewSpend > 0 && totalReviews > 0 && (
          <ReviewKpiCard title="Cost per Review" value={formatMoney(reviewSpend / totalReviews)} badgeText="Average" badgeType="gray" iconPath="/reviews/CostperReview.svg" iconBgColor="bg-[#505F76]/5 text-[#505F76]" />
        )}
      </div>

      <div className="w-full bg-white border border-[#C5C5D9]/10 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-[24px] overflow-hidden flex flex-col mt-4">
        <div className="bg-[#F2F3FF] px-8 py-5 flex flex-col md:flex-row justify-between items-center w-full gap-4 border-b border-[#C5C5D9]/5">
          <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">
            Completed Reviews
          </h3>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            <select
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
              className="bg-white border border-[#C5C5D9]/20 rounded-xl px-4 py-2.5 text-xs font-semibold text-[#131B2E] outline-none"
            >
              {productOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>

            <select
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value as ReviewDateFilter)}
              className="bg-white border border-[#C5C5D9]/20 rounded-xl px-4 py-2.5 text-xs font-semibold text-[#131B2E] outline-none"
            >
              {reviewDateFilters.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#C5C5D9]/10 bg-[#FAF8FF]">
                <th className="p-6 text-left text-[10px] font-bold tracking-wider text-[#454656]/60 uppercase">Customer</th>
                <th className="p-6 text-left text-[10px] font-bold tracking-wider text-[#454656]/60 uppercase">Product Name</th>
                <th className="p-6 text-left text-[10px] font-bold tracking-wider text-[#454656]/60 uppercase">Date</th>
                <th className="p-6 text-left text-[10px] font-bold tracking-wider text-[#454656]/60 uppercase">Star Rating</th>
                {showReward && (
                  <th className="p-6 text-left text-[10px] font-bold tracking-wider text-[#454656]/60 uppercase">Reward</th>
                )}
                <th className="p-6 text-right text-[10px] font-bold tracking-wider text-[#454656]/60 uppercase">Details</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReviews.map((review) => (
                <ReviewRow
                  key={review.id}
                  review={review}
                  isExpanded={expandedId === review.id}
                  onToggleExpand={() => setExpandedId(expandedId === review.id ? null : review.id)}
                  onApprove={review.status === "Pending Approval" ? () => handleApprove(review.id) : undefined}
                  showReward={showReward}
                />
              ))}
              {paginatedReviews.length === 0 && (
                <tr>
                  <td colSpan={showReward ? 6 : 5} className="p-10 text-center text-sm font-semibold text-slate-400">
                    No reviews match the current selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-8 py-5 border-t border-[#C5C5D9]/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-[#454656]">
          <span>
            Showing {paginatedReviews.length ? pageStart + 1 : 0} to{" "}
            {Math.min(pageStart + paginatedReviews.length, filtered.length)} of{" "}
            {filtered.length} reviews
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActivePage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg border border-[#C5C5D9]/20 flex items-center justify-center hover:bg-slate-50 cursor-pointer bg-white text-[#131B2E] disabled:cursor-not-allowed disabled:opacity-40"
            >
              &lt;
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setActivePage(pageNumber)}
                className={`w-8 h-8 rounded-lg border cursor-pointer flex items-center justify-center font-bold text-xs ${
                  currentPage === pageNumber
                    ? "bg-[#001BD2] text-white border-[#001BD2]"
                    : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setActivePage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg border border-[#C5C5D9]/20 flex items-center justify-center hover:bg-slate-50 cursor-pointer bg-white text-[#131B2E] disabled:cursor-not-allowed disabled:opacity-40"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
