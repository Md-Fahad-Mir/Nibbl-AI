"use client";

import { useEffect, useState } from "react";
import { ApiRecord, API_BASE_URL, tokenStorage } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatDate, formatInteger, formatMoney } from "../../utils/backendMappers";

interface ReviewManagementProps {
  onBack: () => void;
  initialProductFilter?: string;
}

const STATUS_TABS = [
  { value: "", label: "All", count: "all" },
  { value: "published", label: "Published", count: "published" },
  { value: "held", label: "7-Day Hold", count: "held" },
  { value: "flagged", label: "Flagged", count: "flagged" },
  { value: "removed", label: "Removed", count: "removed" },
];

const STATUS_BADGE: Record<string, string> = {
  published: "bg-emerald-50 text-[#15803D]",
  held: "bg-red-50 text-red-700",
  flagged: "bg-amber-50 text-amber-700",
  removed: "bg-slate-100 text-slate-500",
};

const STATUS_LABEL: Record<string, string> = {
  published: "Published", held: "Pending Response", flagged: "Flagged — Nibbl reviewing", removed: "Removed",
};

// Must match Apps.reviews.campaigns.FLAG_REASONS (Master "Flag Review for Removal").
const FLAG_REASONS = [
  "Wrong product (does not match receipt)",
  "Unrelated content (not about the product)",
  "Spam or fraud (fake or incentivized content)",
  "Personal information (PII)",
  "Profanity or abusive language",
  "Prohibited claim (e.g., medical, health, unverified)",
  "Other policy violation",
];

const selectClass =
  "bg-white border border-[#E0E3F5] rounded-xl px-3 h-10 text-xs font-semibold text-[#131B2E] outline-none focus:border-[#001BD2]";
const cardClass = "bg-white border border-[#EAEDFF] rounded-[20px] p-5 shadow-sm";
const headingClass = "text-xs font-bold text-[#454656] uppercase tracking-wider";

const Stars = ({ rating }: { rating: number }) => (
  <span className="text-[#F59E0B] tracking-tight whitespace-nowrap" aria-label={`${rating} stars`}>
    {"★".repeat(rating)}
    <span className="text-slate-200">{"★".repeat(Math.max(0, 5 - rating))}</span>
  </span>
);

const VerifiedBadge = () => (
  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#15803D] bg-emerald-50 rounded-full px-2 py-0.5">
    ✓ Verified Purchase
  </span>
);

// j*****k@gmail.com — shown masked; Copy puts the real address on the clipboard.
const maskEmail = (email: string) => {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local[0]}${"*".repeat(5)}${local.length > 1 ? local[local.length - 1] : ""}@${domain}`;
};

const timeLeft = (until: string, now: number) => {
  const ms = new Date(until).getTime() - now;
  if (!(ms > 0)) return "any moment";
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  return `${d} day${d === 1 ? "" : "s"} ${h} hour${h === 1 ? "" : "s"} ${m} minute${m === 1 ? "" : "s"}`;
};

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function ReviewDetails({ review, onClose }: { review: ApiRecord; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const receipt = (review.receipt ?? null) as ApiRecord | null;
  const answers = (Array.isArray(review.questions_and_answers) ? review.questions_and_answers : []) as ApiRecord[];
  const checks = (Array.isArray(review.verification) ? review.verification : []) as ApiRecord[];
  const email = String(review.customer_email ?? "");
  const meta = [formatDate(String(review.created_at ?? "")), review.retailer, review.region].filter(Boolean).join(" · ");

  const copy = async () => {
    await navigator.clipboard.writeText(email);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <aside className={`${cardClass} flex flex-col gap-4 text-sm lg:sticky lg:top-4`}>
      <div className="flex justify-between items-start">
        <h3 className="font-jakarta text-lg font-bold text-[#131B2E]">Review Details</h3>
        <button onClick={onClose} aria-label="Close" className="text-[#94A3B8] hover:text-[#131B2E] text-lg cursor-pointer">✕</button>
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-bold text-[#131B2E]">{String(review.product_name ?? "")}</span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-[#454656]">
          <b>{String(review.shopper_name ?? "")}</b>
          {review.verified_purchase ? <VerifiedBadge /> : null}
          <Stars rating={Number(review.rating ?? 0)} /> {String(review.rating ?? "")}/5
        </span>
        <span className="text-xs text-[#94A3B8]">Submitted {meta}</span>
      </div>

      <div>
        <div className={headingClass}>Review Title</div>
        <p className="font-semibold text-[#131B2E] mt-1">{String(review.title ?? "")}</p>
      </div>
      <div>
        <div className={headingClass}>Full Review Text</div>
        <p className="text-[#131B2E] mt-1 leading-6">{String(review.content ?? "")}</p>
        {Boolean(review.disclosure) && <p className="text-xs text-[#94A3B8] mt-1">{String(review.disclosure)}</p>}
      </div>

      {answers.length > 0 && (
        <div>
          <div className={headingClass}>Shopper Answer Highlights</div>
          <dl className="mt-2 bg-[#F8F9FF] rounded-xl p-3 flex flex-col gap-2">
            {answers.filter((a) => a.question && a.answer).map((a, i) => (
              <div key={i}>
                <dt className="text-xs text-[#64748B]">{String(a.question)}</dt>
                <dd className="text-sm font-semibold text-[#131B2E]">{String(a.answer)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {Boolean(review.brand_response) && (
        <div>
          <div className={headingClass}>Your Public Response</div>
          <p className="text-[#131B2E] mt-1">{String(review.brand_response)}</p>
        </div>
      )}

      {(receipt || checks.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {receipt && (
            <div>
              <div className={headingClass}>Receipt Evidence</div>
              {receipt.image_url ? (
                <a href={String(receipt.image_url)} target="_blank" rel="noreferrer" className="block mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={String(receipt.image_url)} alt="Receipt" className="w-full h-28 object-cover rounded-lg border border-[#EAEDFF]" />
                </a>
              ) : (
                <p className="text-xs text-[#64748B] mt-2">Verified receipt</p>
              )}
            </div>
          )}
          {checks.length > 0 && (
            <div>
              <div className={headingClass}>Gating Summary</div>
              <ul className="mt-2 flex flex-col gap-1 text-xs">
                {checks.map((c) => (
                  <li key={String(c.label)} className={c.ok ? "text-[#15803D]" : "text-[#94A3B8]"}>
                    {c.ok ? "✓" : "○"} <span className="text-[#454656]">{String(c.label)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-[#F1F2FA] pt-3">
        <div className={headingClass}>Customer Contact (Service Recovery)</div>
        {email ? (
          <>
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="font-semibold text-[#131B2E]">{maskEmail(email)}</span>
              <button onClick={() => void copy()} className="text-xs font-bold text-[#001BD2] cursor-pointer">
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">Shown for service recovery purposes only. Do not share or use for marketing.</p>
          </>
        ) : (
          <p className="text-xs text-[#94A3B8] mt-2">On your plan, the customer&apos;s email is shown only for 1–3★ reviews.</p>
        )}
      </div>
    </aside>
  );
}

function LowRatingResponse({ review, now, onChanged }: { review: ApiRecord; now: number; onChanged: () => void }) {
  const brandReviewAction = useBrandApiStore((s) => s.brandReviewAction);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState(String(review.brand_response ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const email = String(review.customer_email ?? "");
  const held = review.status === "held";

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await brandReviewAction(String(review.id), "respond", { text });
      setWriting(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the response.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${cardClass} flex flex-col gap-3`}>
      <h4 className="font-jakarta font-bold text-[#131B2E]">Low-Rating Response (1–3 Stars)</h4>
      {held && Boolean(review.held_until) && (
        <div className="bg-red-50/60 border border-red-100 rounded-xl p-3">
          <div className="text-xs text-red-700">Auto-publish in</div>
          <div className="font-jakarta font-bold text-[#131B2E]">{timeLeft(String(review.held_until), now)}</div>
          <div className="text-[11px] text-[#64748B]">This review will be automatically published if no action is taken.</div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {email && (
          <a href={`mailto:${email}?subject=${encodeURIComponent(`About your ${String(review.product_name ?? "")} review`)}`}
            className="h-9 px-4 rounded-full border border-[#001BD2]/30 text-[#001BD2] text-xs font-bold inline-flex items-center">
            Contact Customer
          </a>
        )}
        {review.status !== "removed" && (
          <button onClick={() => setWriting((w) => !w)}
            className="h-9 px-4 rounded-full bg-[#001BD2] text-white text-xs font-bold cursor-pointer">
            {review.brand_response ? "Edit Brand Response" : "Add Brand Response"}
          </button>
        )}
      </div>
      {writing && (
        <div className="flex flex-col gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000}
            placeholder="Your public response, shown under the review"
            className="border border-[#E0E3F5] rounded-xl p-3 text-sm outline-none focus:border-[#001BD2]" />
          <button disabled={busy || !text.trim()} onClick={() => void save()}
            className="self-end h-9 px-5 rounded-full bg-[#001BD2] text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
            {busy ? "Saving…" : "Post response"}
          </button>
        </div>
      )}
      {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
    </section>
  );
}

function FlagForRemoval({ review, onChanged }: { review: ApiRecord; onChanged: () => void }) {
  const brandReviewAction = useBrandApiStore((s) => s.brandReviewAction);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await brandReviewAction(String(review.id), "flag", { reason, note });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not flag the review.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${cardClass} flex flex-col gap-3`}>
      <h4 className="font-jakarta font-bold text-[#131B2E]">Flag Review for Removal</h4>
      <div className="flex flex-col gap-1.5">
        {FLAG_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-2 text-xs text-[#454656] cursor-pointer">
            <input type="radio" name={`flag-${String(review.id)}`} checked={reason === r} onChange={() => setReason(r)} />
            {r}
          </label>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-xs text-[#454656]">
        Additional details (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={2}
          placeholder="Provide more context for this flag…"
          className="border border-[#E0E3F5] rounded-xl p-2 text-sm outline-none focus:border-[#001BD2]" />
        <span className="self-end text-[10px] text-[#94A3B8]">{note.length}/500</span>
      </label>
      <p className="text-[11px] text-[#64748B] bg-[#F8F9FF] rounded-lg p-2">
        Nibbl Audit Trail: all flag actions are logged and reviewed by the Nibbl team. You will be notified of the outcome.
      </p>
      <button disabled={busy || !reason} onClick={() => void submit()}
        className="self-start h-9 px-4 rounded-full border border-red-200 text-red-600 text-xs font-bold disabled:opacity-50 cursor-pointer">
        {busy ? "Flagging…" : "Flag for Removal"}
      </button>
      {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
    </section>
  );
}

/** Master Review Management: performance summary, tabs + filters, review
 *  list and details, low-rating response, flag for removal and export. */
export default function ReviewManagement({ onBack, initialProductFilter }: ReviewManagementProps) {
  const products = useBrandApiStore((s) => s.products);
  const selectedBrandId = useBrandApiStore((s) => s.selectedBrandId);
  const loadBrandReviews = useBrandApiStore((s) => s.loadBrandReviews);
  const now = useNow();

  const [status, setStatus] = useState("");
  const [rating, setRating] = useState("");
  const [retailer, setRetailer] = useState("");
  const [region, setRegion] = useState("");
  const [q, setQ] = useState("");
  const [product, setProduct] = useState(
    () => products.find((p) => p.name === initialProductFilter)?.id ?? ""
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<ApiRecord | null>(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [downloading, setDownloading] = useState("");

  const filters: Record<string, string> = Object.fromEntries(
    Object.entries({ status, rating, product, retailer, region, q: q.trim(), from, to }).filter(([, v]) => v)
  );
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      loadBrandReviews(JSON.parse(filterKey))
        .then((result) => live && (setData(result), setError("")))
        .catch((err) => live && setError(err instanceof Error ? err.message : "Could not load reviews."));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [loadBrandReviews, filterKey, reloadKey]);

  const summary = (data?.summary ?? {}) as ApiRecord;
  const counts = (summary.status_counts ?? {}) as ApiRecord;
  const options = (data?.filter_options ?? {}) as ApiRecord;
  const retailers = (Array.isArray(options.retailers) ? options.retailers : []) as string[];
  const regions = (Array.isArray(options.regions) ? options.regions : []) as string[];
  const reviews = Array.isArray(data?.reviews) ? (data.reviews as ApiRecord[]) : [];
  const selected = reviews.find((r) => String(r.id) === selectedId) ?? null;
  const changed = () => setReloadKey((k) => k + 1);

  const download = async (kind: "csv" | "text") => {
    if (!selectedBrandId || downloading) return;
    setDownloading(kind);
    try {
      const token = tokenStorage.getAccess();
      const params = new URLSearchParams({ ...filters, ...(kind === "text" ? { type: "text" } : {}) }).toString();
      const response = await fetch(
        `${API_BASE_URL}/brands/${selectedBrandId}/reviews/export/${params ? `?${params}` : ""}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!response.ok) throw new Error("Could not export reviews.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = kind === "csv" ? "reviews.csv" : "reviews.txt";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export reviews.");
    } finally {
      setDownloading("");
    }
  };

  const kpis = [
    { label: "Total Reviews", value: formatInteger(Number(summary.total_reviews ?? 0)), note: "Excluding removed reviews" },
    { label: "Pending 1–3 Star Response", value: formatInteger(Number(summary.low_rating_awaiting_action ?? 0)), note: "Publishes after 7 days" },
    { label: "Average Rating", value: summary.average_rating == null ? "—" : `${Number(summary.average_rating).toFixed(1)} / 5.0`, note: "Published reviews" },
    { label: "Review Spend", value: formatMoney(summary.review_spend ?? 0), note: "$1 rewards + review fees" },
    { label: "Cost per Review", value: summary.cost_per_review == null ? "—" : formatMoney(summary.cost_per_review), note: "Spend ÷ completed reviews" },
  ];

  return (
    <div className="flex flex-col gap-6 w-full animate-slide-up text-left font-manrope bg-[#FAF8FF]">
      <button onClick={onBack}
        className="text-[#001BD2] font-bold text-sm hover:opacity-80 transition-all self-start cursor-pointer border-none bg-transparent">
        Back
      </button>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">Review Management</h2>
        <p className="text-[#454656] text-sm md:text-base font-medium">
          Monitor, moderate, and respond to product reviews. Build trust with authentic shopper feedback.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 w-full">
        {kpis.map((k) => (
          <div key={k.label} className={cardClass}>
            <div className="text-xs font-semibold text-[#454656]">{k.label}</div>
            <div className="font-jakarta text-2xl font-extrabold text-[#131B2E] mt-1">{k.value}</div>
            <div className="text-[11px] text-[#94A3B8] mt-1">{k.note}</div>
          </div>
        ))}
      </div>

      <div className={`${cardClass} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map((tab) => (
              <button key={tab.value} onClick={() => setStatus(tab.value)}
                className={`px-4 h-9 text-xs font-bold rounded-full cursor-pointer ${
                  status === tab.value ? "bg-[#001BD2] text-white" : "bg-[#F2F3FF] text-[#454656] hover:text-[#131B2E]"
                }`}>
                {tab.label} ({formatInteger(Number(counts[tab.count] ?? 0))})
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectClass} aria-label="From" />
            <span className="text-xs text-[#94A3B8]">–</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectClass} aria-label="To" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reviews by product name or keyword…"
            className={`${selectClass} lg:col-span-1`} />
          <select value={rating} onChange={(e) => setRating(e.target.value)} className={selectClass} aria-label="Rating">
            <option value="">All Ratings</option>
            {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r}★</option>)}
          </select>
          <select value={retailer} onChange={(e) => setRetailer(e.target.value)} className={selectClass} aria-label="Retailer">
            <option value="">All Retailers</option>
            {retailers.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={product} onChange={(e) => setProduct(e.target.value)} className={selectClass} aria-label="Product">
            <option value="">All Products</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectClass} aria-label="Region">
            <option value="">All Regions</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="text-sm font-semibold text-red-700">{error}</div>}

      <div className={`grid grid-cols-1 gap-6 items-start ${selected ? "lg:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        <div className="bg-white border border-[#EAEDFF] rounded-[20px] shadow-sm overflow-x-auto">
          <table className="w-full border-collapse text-sm text-[#454656]">
            <thead>
              <tr className="border-b border-[#EAEDFF] text-[10px] font-bold tracking-wider text-[#454656]/60 uppercase">
                <th className="p-4 text-left">Reviewer</th>
                <th className="p-4 text-left">Product</th>
                <th className="p-4 text-left">Rating</th>
                <th className="p-4 text-left">Review Title</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Reward</th>
                <th className="p-4 text-left">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => {
                const id = String(review.id);
                const reviewStatus = String(review.status);
                return (
                  <tr key={id} onClick={() => setSelectedId(id === selectedId ? null : id)}
                    className={`border-b border-[#F1F2FA] cursor-pointer ${id === selectedId ? "bg-[#001BD2]/5" : "hover:bg-slate-50/60"}`}>
                    <td className="p-4">
                      <div className="font-bold text-[#131B2E]">{String(review.shopper_name ?? "Customer")}</div>
                      {review.verified_purchase ? <VerifiedBadge /> : null}
                    </td>
                    <td className="p-4 font-semibold text-[#131B2E] max-w-[180px] truncate">{String(review.product_name ?? "")}</td>
                    <td className="p-4"><Stars rating={Number(review.rating ?? 0)} /></td>
                    <td className="p-4 max-w-[200px] truncate">{String(review.title ?? "")}</td>
                    <td className="p-4">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_BADGE[reviewStatus] ?? ""}`}>
                        {STATUS_LABEL[reviewStatus] ?? reviewStatus}
                      </span>
                    </td>
                    <td className="p-4">{review.reward ? formatMoney(review.reward) : "—"}</td>
                    <td className="p-4 whitespace-nowrap">{formatDate(String(review.created_at ?? ""))}</td>
                  </tr>
                );
              })}
              {data && reviews.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm font-semibold text-slate-400">
                    No reviews match the current selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {selected && <ReviewDetails review={selected} onClose={() => setSelectedId(null)} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {selected && Number(selected.rating) <= 3 && selected.status !== "removed" ? (
          <LowRatingResponse key={`r-${String(selected.id)}`} review={selected} now={now} onChanged={changed} />
        ) : (
          <section className={`${cardClass} text-sm text-[#64748B]`}>
            <h4 className="font-jakarta font-bold text-[#131B2E] mb-2">Low-Rating Response (1–3 Stars)</h4>
            Reviews rated three stars or lower are held for seven days. Select one to contact the customer, add a
            response, or flag it. If no action is taken, it publishes automatically.
          </section>
        )}
        {selected && (selected.status === "held" || selected.status === "published") ? (
          <FlagForRemoval key={`f-${String(selected.id)}`} review={selected} onChanged={changed} />
        ) : (
          <section className={`${cardClass} text-sm text-[#64748B]`}>
            <h4 className="font-jakarta font-bold text-[#131B2E] mb-2">Flag Review for Removal</h4>
            Select a published or held review to flag it for Nibbl. Every flag and outcome is recorded in the audit history.
          </section>
        )}
        <section className={`${cardClass} flex flex-col gap-2`}>
          <h4 className="font-jakarta font-bold text-[#131B2E]">Export Reviews</h4>
          <button onClick={() => void download("csv")} disabled={Boolean(downloading)}
            className="h-10 rounded-full border border-[#001BD2]/30 text-[#001BD2] text-sm font-bold disabled:opacity-50 cursor-pointer">
            {downloading === "csv" ? "Downloading…" : "Download CSV"}
          </button>
          <button onClick={() => void download("text")} disabled={Boolean(downloading)}
            className="h-10 rounded-full border border-[#001BD2]/30 text-[#001BD2] text-sm font-bold disabled:opacity-50 cursor-pointer">
            {downloading === "text" ? "Downloading…" : "Download Reviews"}
          </button>
          <p className="text-[11px] text-[#94A3B8] text-center">
            Every exported review includes &quot;Verified Purchase · Rewarded for an honest review.&quot;
          </p>
          <div className="flex items-center justify-between bg-[#F8F9FF] rounded-xl px-3 py-2 text-xs text-[#454656]">
            API Integration
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Coming soon</span>
          </div>
        </section>
      </div>
    </div>
  );
}
