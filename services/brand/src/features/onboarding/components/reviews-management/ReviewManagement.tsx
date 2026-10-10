"use client";

import { Fragment, useEffect, useState } from "react";
import ReviewKpiCard from "./ReviewKpiCard";
import AIChatHistory from "./AIChatHistory";
import { ApiRecord, API_BASE_URL, tokenStorage } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatDate, formatInteger } from "../../utils/backendMappers";

interface ReviewManagementProps {
  onBack: () => void;
  initialProductFilter?: string;
}

const STATUS_TABS = [
  { value: "", label: "All Reviews" },
  { value: "held", label: "Awaiting Action" },
  { value: "published", label: "Published" },
  { value: "flagged", label: "Flagged" },
  { value: "removed", label: "Removed" },
];

const STATUS_BADGE: Record<string, string> = {
  published: "bg-emerald-50 text-[#15803D]",
  held: "bg-amber-50 text-amber-700",
  flagged: "bg-red-50 text-red-700",
  removed: "bg-slate-100 text-slate-500",
};

const STATUS_LABEL: Record<string, string> = {
  published: "Published", held: "Held", flagged: "Flagged — Nibbl reviewing", removed: "Removed",
};

// Must match Apps.reviews.campaigns.FLAG_REASONS.
const FLAG_REASONS = [
  "Not about this product", "Offensive or abusive", "Contains personal information",
  "Spam or advertising", "Suspected fraud", "Other",
];

const selectClass =
  "bg-white border border-[#C5C5D9]/20 rounded-xl px-4 py-2.5 text-xs font-semibold text-[#131B2E] outline-none";

const chatMessages = (value: unknown) =>
  (Array.isArray(value) ? (value as ApiRecord[]) : []).flatMap((entry, index) => [
    ...(entry.question ? [{ id: `${index}-q`, sender: "assistant" as const, text: String(entry.question) }] : []),
    ...(entry.answer ? [{ id: `${index}-a`, sender: "shopper" as const, text: String(entry.answer) }] : []),
  ]);

const Stars = ({ rating }: { rating: number }) => (
  <span className="text-[#F59E0B] tracking-tight" aria-label={`${rating} stars`}>
    {"★".repeat(rating)}
    <span className="text-slate-200">{"★".repeat(Math.max(0, 5 - rating))}</span>
  </span>
);

function ReviewDetail({ review, onChanged }: { review: ApiRecord; onChanged: () => void }) {
  const brandReviewAction = useBrandApiStore((s) => s.brandReviewAction);
  const [response, setResponse] = useState(String(review.brand_response ?? ""));
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = String(review.status);
  const receipt = (review.receipt ?? null) as ApiRecord | null;
  const canFlag = status === "held" || status === "published";

  const act = async (action: "respond" | "flag", body: ApiRecord) => {
    setError("");
    setBusy(true);
    try {
      await brandReviewAction(String(review.id), action, body);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-[960px] mx-auto">
      <AIChatHistory messages={chatMessages(review.questions_and_answers)} />
      <div className="bg-white border border-[#001BD2]/20 rounded-2xl p-6 flex flex-col gap-4 text-sm">
        <div>
          <div className="font-bold text-[#131B2E]">{String(review.title ?? "")}</div>
          <p className="text-[#131B2E] mt-1 leading-6">{String(review.content ?? "")}</p>
          {review.would_recommend !== null && review.would_recommend !== undefined && (
            <p className="text-xs text-[#64748B] mt-2">
              Would recommend / buy again: <b>{review.would_recommend ? "Yes" : "No"}</b>
            </p>
          )}
          {Boolean(review.disclosure) && <p className="text-xs text-[#94A3B8] mt-2">{String(review.disclosure)}</p>}
        </div>

        <div className="text-xs text-[#454656] flex flex-col gap-1 border-t border-[#F1F2FA] pt-3">
          <span>Customer: <b>{String(review.shopper_name ?? "")}</b> · {String(review.customer_email ?? "")}</span>
          {Boolean(review.campaign_name) && <span>Campaign: {String(review.campaign_name)}</span>}
          {receipt && (
            <span>
              Receipt: {String(receipt.merchant ?? "Verified receipt")}
              {receipt.purchased_at ? ` · ${formatDate(String(receipt.purchased_at))}` : ""}
              {Boolean(receipt.image_url) && (
                <> · <a href={String(receipt.image_url)} target="_blank" rel="noreferrer" className="text-[#001BD2] font-bold">View receipt</a></>
              )}
            </span>
          )}
          {status === "held" && Boolean(review.held_until) && (
            <span className="text-amber-700">Publishes {formatDate(String(review.held_until))} unless flagged.</span>
          )}
          {status === "flagged" && <span className="text-red-700">Flagged: {String(review.flag_reason)}</span>}
        </div>

        {status !== "removed" && (
          <div className="flex flex-col gap-2 border-t border-[#F1F2FA] pt-3">
            <label className="text-xs font-bold text-[#454656] uppercase tracking-wider">Public brand response</label>
            <textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={3} maxLength={2000}
              className="border border-[#E0E3F5] rounded-xl p-3 text-sm outline-none focus:border-[#001BD2]" />
            <button disabled={busy || !response.trim() || response === review.brand_response}
              onClick={() => act("respond", { text: response })}
              className="self-end h-9 px-5 rounded-full bg-[#001BD2] text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
              {review.brand_response ? "Update response" : "Post response"}
            </button>
          </div>
        )}

        {canFlag && (
          <div className="flex flex-col gap-2 border-t border-[#F1F2FA] pt-3">
            <label className="text-xs font-bold text-[#454656] uppercase tracking-wider">Flag for Nibbl review</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={selectClass}>
              <option value="">Choose a removal reason</option>
              {FLAG_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for Nibbl (optional)"
              className="border border-[#E0E3F5] rounded-xl px-3 h-10 text-sm outline-none focus:border-[#001BD2]" />
            <button disabled={busy || !reason} onClick={() => act("flag", { reason, note })}
              className="self-end h-9 px-5 rounded-full border border-red-200 text-red-600 text-xs font-bold disabled:opacity-50 cursor-pointer">
              Flag review
            </button>
          </div>
        )}
        {error && <div className="text-xs font-semibold text-red-700">{error}</div>}
      </div>
    </div>
  );
}

/** Master Review Management: every review with filters, the AI Q&A, receipt
 *  and customer, public responses, flagging, and CSV export. */
export default function ReviewManagement({ onBack, initialProductFilter }: ReviewManagementProps) {
  const products = useBrandApiStore((s) => s.products);
  const selectedBrandId = useBrandApiStore((s) => s.selectedBrandId);
  const loadBrandReviews = useBrandApiStore((s) => s.loadBrandReviews);

  const [status, setStatus] = useState("");
  const [rating, setRating] = useState("");
  const [product, setProduct] = useState(
    () => products.find((p) => p.name === initialProductFilter)?.id ?? ""
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<ApiRecord | null>(null);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  const filters: Record<string, string> = Object.fromEntries(
    Object.entries({ status, rating, product, from, to }).filter(([, v]) => v)
  );
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    let live = true;
    loadBrandReviews(JSON.parse(filterKey))
      .then((result) => live && (setData(result), setError("")))
      .catch((err) => live && setError(err instanceof Error ? err.message : "Could not load reviews."));
    return () => {
      live = false;
    };
  }, [loadBrandReviews, filterKey, reloadKey]);

  const summary = (data?.summary ?? {}) as ApiRecord;
  const reviews = Array.isArray(data?.reviews) ? (data.reviews as ApiRecord[]) : [];

  const handleExport = async () => {
    if (!selectedBrandId || exporting) return;
    setExporting(true);
    try {
      const token = tokenStorage.getAccess();
      const query = new URLSearchParams(filters).toString();
      const response = await fetch(
        `${API_BASE_URL}/brands/${selectedBrandId}/reviews/export/${query ? `?${query}` : ""}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!response.ok) throw new Error("Could not export reviews.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "reviews.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export reviews.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left font-manrope bg-[#FAF8FF]">
      <button onClick={onBack}
        className="text-[#001BD2] font-bold text-sm hover:opacity-80 transition-all self-start cursor-pointer border-none bg-transparent">
        Back
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end w-full gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">Reviews Management</h2>
          <p className="text-[#454656] text-sm md:text-base font-medium">
            1–3★ reviews are held for 7 days so you can respond publicly or flag them for Nibbl.
          </p>
        </div>
        <button onClick={handleExport} disabled={exporting}
          className="h-10 px-5 rounded-full bg-[#E2E7FF] text-[#001BD2] font-bold text-sm disabled:opacity-50 cursor-pointer">
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
        <ReviewKpiCard title="Total Reviews" value={formatInteger(Number(summary.total_reviews ?? 0))} badgeText="Live"
          badgeType="green" iconPath="/reviews/TotalReviews.svg" iconBgColor="bg-[#001BD2]/5 text-[#001BD2]" />
        <ReviewKpiCard title="Low Ratings Awaiting Action" value={formatInteger(Number(summary.low_rating_awaiting_action ?? 0))}
          badgeText="1–3★" badgeType="gray" iconPath="/reviews/ReviewSpend.svg" iconBgColor="bg-[#004956]/5 text-[#004956]" />
        <ReviewKpiCard title="Average Rating"
          value={summary.average_rating == null ? "—" : Number(summary.average_rating).toFixed(1)}
          badgeText="Published" badgeType="gray" iconPath="/reviews/CostperReview.svg" iconBgColor="bg-[#505F76]/5 text-[#505F76]" />
      </div>

      <div className="w-full bg-white border border-[#C5C5D9]/10 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-[24px] overflow-hidden flex flex-col">
        <div className="bg-[#F2F3FF] px-8 py-5 flex flex-col gap-4 border-b border-[#C5C5D9]/5">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map((tab) => (
              <button key={tab.value} onClick={() => setStatus(tab.value)}
                className={`px-4 py-2 text-xs font-bold rounded-full border-none cursor-pointer ${
                  status === tab.value ? "bg-white text-[#001BD2] shadow-sm" : "text-[#454656] hover:text-slate-700"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select value={product} onChange={(e) => setProduct(e.target.value)} className={selectClass}>
              <option value="">All Products</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={rating} onChange={(e) => setRating(e.target.value)} className={selectClass}>
              <option value="">All Ratings</option>
              {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r}★</option>)}
            </select>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectClass} aria-label="From" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectClass} aria-label="To" />
          </div>
        </div>

        {error && <div className="px-8 py-3 text-sm font-semibold text-red-700">{error}</div>}

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-sm text-[#454656]">
            <thead>
              <tr className="border-b border-[#C5C5D9]/10 bg-[#FAF8FF] text-[10px] font-bold tracking-wider text-[#454656]/60 uppercase">
                <th className="p-5 text-left">Customer</th>
                <th className="p-5 text-left">Product</th>
                <th className="p-5 text-left">Date</th>
                <th className="p-5 text-left">Rating</th>
                <th className="p-5 text-left">Status</th>
                <th className="p-5 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => {
                const id = String(review.id);
                const open = expandedId === id;
                const reviewStatus = String(review.status);
                return (
                  <Fragment key={id}>
                    <tr className={`border-b border-[#C5C5D9]/10 ${open ? "bg-[#001BD2]/5" : "hover:bg-slate-50/50"}`}>
                      <td className="p-5">
                        <div className="font-bold text-[#131B2E]">{String(review.shopper_name ?? "Customer")}</div>
                        <div className="text-xs text-[#454656]/70">{String(review.customer_email ?? "")}</div>
                      </td>
                      <td className="p-5 font-semibold text-[#131B2E] max-w-[200px] truncate">{String(review.product_name ?? "")}</td>
                      <td className="p-5">{formatDate(String(review.created_at ?? ""))}</td>
                      <td className="p-5"><Stars rating={Number(review.rating ?? 0)} /></td>
                      <td className="p-5">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_BADGE[reviewStatus] ?? ""}`}>
                          {STATUS_LABEL[reviewStatus] ?? reviewStatus}
                        </span>
                        {Boolean(review.brand_response) && <span className="ml-2 text-[11px] text-[#001BD2] font-bold">Responded</span>}
                      </td>
                      <td className="p-5 text-right">
                        <button onClick={() => setExpandedId(open ? null : id)}
                          className="w-8 h-8 rounded-lg hover:bg-slate-100/80 text-[#001BD2] font-bold border-none cursor-pointer">
                          <span className={`inline-block transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-[#001BD2]/5 border-b border-[#C5C5D9]/10">
                        <td colSpan={6} className="p-6">
                          <ReviewDetail review={review} onChanged={() => setReloadKey((k) => k + 1)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {data && reviews.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-sm font-semibold text-slate-400">
                    No reviews match the current selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
