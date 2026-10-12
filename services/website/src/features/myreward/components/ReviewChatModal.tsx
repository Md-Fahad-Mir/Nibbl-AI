/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";

interface ReviewChatModalProps {
  opportunity: ApiRecord;
  onClose: () => void;
  onSubmitted: (productName: string, rewardAmount: string) => void;
}

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

type Stage = "loading" | "confirm" | "matches" | "consent" | "voice" | "chat";

const TITLE_MAX = 100;
const BODY_MAX = 500;

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const ProductLine = ({ product }: { product: ApiRecord }) => (
  <div className="flex flex-col gap-0.5 text-left">
    <span className="font-semibold text-[#1F1D1D]">{String(product.name ?? "")}{product.flavor ? ` ${String(product.flavor)}` : ""}</span>
    <span className="text-xs text-gray-500">
      {[product.size_label, product.category && `Category: ${String(product.category)}`].filter(Boolean).map(String).join(" · ")}
    </span>
    {Number(product.review_count) > 0 && (
      <span className="text-xs text-gray-500">★ {String(product.avg_rating)} · {String(product.review_count)} reviews</span>
    )}
  </div>
);

/** Master Shopper Review Opportunity + AI Chat Review: Product Confirmed (or
 *  Multiple Matches) → Missing Consent (only if missing) → Share Your Voice →
 *  the AI chat (suggested answers, separate recommend / buy-again questions)
 *  → final edit (title ≤ 100, review ≤ 500) and submit. $1 at every rating. */
export default function ReviewChatModal({ opportunity, onClose, onSubmitted }: ReviewChatModalProps) {
  const sessionId = String(opportunity.id ?? "");
  const reward = Number(opportunity.reward_amount ?? 1).toFixed(2);
  const submitReview = useConsumerApiStore((state) => state.submitReview);
  const loadRewardsHub = useConsumerApiStore((state) => state.loadRewardsHub);

  const [stage, setStage] = useState<Stage>("loading");
  const [overview, setOverview] = useState<ApiRecord | null>(null);
  const [pick, setPick] = useState("");
  const [consent, setConsent] = useState({ nibbl: false, brand: false });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [draft, setDraft] = useState<{ title: string; content: string } | null>(null);
  const [inputText, setInputText] = useState("");
  const [rating, setRating] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const product = (overview?.product ?? {}) as ApiRecord;
  const candidates = (Array.isArray(overview?.candidates) ? overview.candidates : []) as ApiRecord[];
  const needs = (overview?.needs_consent ?? {}) as ApiRecord;
  const productName = [product.name, product.flavor].filter(Boolean).map(String).join(" ") || String(opportunity.product_name || "this product");

  const nextAfterProduct = (data: ApiRecord) =>
    (data.needs_consent as ApiRecord)?.nibbl || (data.needs_consent as ApiRecord)?.brand ? "consent" : "voice";

  useEffect(() => {
    let live = true;
    nibblApi
      .reviewOverview(sessionId)
      .then((data) => {
        if (!live) return;
        setOverview(data);
        const matches = Array.isArray(data.candidates) ? data.candidates : [];
        setPick(String((data.product as ApiRecord)?.id ?? ""));
        setStage(data.chat_started ? "chat" : data.product_confirmed ? nextAfterProduct(data) : matches.length ? "matches" : "confirm");
      })
      .catch((err) => live && (setError(errorText(err, "Could not open this review.")), setStage("chat")));
    return () => {
      live = false;
    };
  }, [sessionId]);

  // The chat: opening the session plans the questions and asks the first one.
  useEffect(() => {
    if (stage !== "chat") return;
    let live = true;
    nibblApi
      .reviewSession(sessionId)
      .then((session) => {
        if (!live) return;
        const history = (Array.isArray(session.messages) ? session.messages : []) as ChatMessage[];
        const prompts = Array.isArray(session.prompts) ? session.prompts : [];
        const answered = history.filter((m) => m.role === "user").length;
        setMessages(history);
        setSuggestions((Array.isArray(session.suggestions) ? session.suggestions : []).map(String));
        if (prompts.length && answered >= prompts.length) {
          setDraft({ title: String(session.ai_review_title ?? ""), content: String(session.ai_review_content ?? "") });
        }
      })
      .catch((err) => live && setError(errorText(err, "Could not open this review.")));
    return () => {
      live = false;
    };
  }, [stage, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, draft]);

  const step = async (name: "confirm" | "decline" | "consent", body: ApiRecord, next: (data: ApiRecord) => void) => {
    setBusy(true);
    setError(null);
    try {
      const data = await nibblApi.reviewStep(sessionId, name, body);
      setOverview(data);
      next(data);
    } catch (err) {
      setError(errorText(err, "Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  const sendAnswer = async (value?: string) => {
    const text = (value ?? inputText).trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await nibblApi.answerReview(sessionId, text);
      setInputText("");
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        ...(result.next_prompt ? [{ role: "assistant" as const, content: String(result.next_prompt) }] : []),
      ]);
      setSuggestions((Array.isArray(result.suggestions) ? result.suggestions : []).map(String));
      if (result.done) setDraft({ title: String(result.title ?? ""), content: String(result.review ?? "") });
    } catch (err) {
      setError(errorText(err, "Could not send your answer."));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await nibblApi.regenerateReview(sessionId);
      setDraft({ title: String(result.title ?? ""), content: String(result.review ?? "") });
    } catch (err) {
      setError(errorText(err, "Could not rewrite the review."));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!draft) return;
    if (!rating) return setError("Choose a star rating.");
    if (!draft.content.trim()) return setError("Your review can't be empty.");
    if (draft.title.length > TITLE_MAX || draft.content.length > BODY_MAX) return setError("Shorten your review to fit the limits.");
    if (!confirmed) return setError("Confirm the review reflects your honest experience.");
    setBusy(true);
    setError(null);
    try {
      await submitReview(sessionId, { rating, title: draft.title.trim(), content: draft.content.trim() });
      onSubmitted(productName, reward);
    } catch (err) {
      setError(errorText(err, "Could not submit review."));
    } finally {
      setBusy(false);
    }
  };

  const primary = "w-full py-3 bg-[#3E3EDF] text-white text-sm font-semibold rounded-lg hover:bg-[#3232c7] disabled:opacity-60 cursor-pointer";
  const secondary = "w-full py-3 border border-[#3E3EDF] text-[#3E3EDF] text-sm font-semibold rounded-lg disabled:opacity-60 cursor-pointer";
  const image = String(product.image_url || overview?.campaign_image || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-[500px] h-[85vh] min-h-[550px] bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden relative border border-gray-100">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-gray-800 truncate max-w-[340px]">
              {{ loading: "Review", confirm: "Product Confirmed", matches: "Multiple Matches", consent: "Review Consent",
                voice: "Share Your Voice", chat: `Review: ${productName}` }[stage]}
            </span>
            <span className="text-xs text-gray-500">Earn ${reward} for an honest review</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-2xl font-bold cursor-pointer">&times;</button>
        </div>

        {stage === "loading" && <p className="text-sm text-gray-500 text-center mt-10">Loading your review…</p>}

        {stage === "confirm" && (
          <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-4 text-center">
            <div className="bg-emerald-50 text-emerald-800 rounded-lg p-3 text-sm text-left">
              <b>Purchase verified</b><br />Your receipt matched this product in our active review campaigns.
            </div>
            {image && <img src={image} alt="" className="h-48 object-contain mx-auto" />}
            <ProductLine product={product} />
            <p className="font-semibold text-[#1F1D1D]">Is this the product you purchased?</p>
            <button disabled={busy} className={primary}
              onClick={() => void step("confirm", { product_id: product.id }, (d) => setStage(nextAfterProduct(d)))}>Yes, share my voice</button>
            <button disabled={busy} className={secondary}
              onClick={() => candidates.length ? setStage("matches") : void step("decline", {}, () => { void loadRewardsHub(); onClose(); })}>
              This isn&apos;t my product
            </button>
          </div>
        )}

        {stage === "matches" && (
          <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-3">
            <p className="text-sm text-gray-600 bg-[#F0F8FB] rounded-lg p-3">
              This receipt wording may match more than one product. <b>Which did you purchase?</b>
            </p>
            {candidates.map((c) => (
              <label key={String(c.id)} className={`flex items-center gap-3 border rounded-xl p-3 cursor-pointer ${
                pick === String(c.id) ? "border-[#3E3EDF] bg-blue-50/40" : "border-gray-200"}`}>
                <input type="radio" checked={pick === String(c.id)} onChange={() => setPick(String(c.id))} />
                {c.image_url ? <img src={String(c.image_url)} alt="" className="w-14 h-14 object-contain" /> : null}
                <ProductLine product={c} />
              </label>
            ))}
            <button disabled={busy || !pick} className={primary}
              onClick={() => void step("confirm", { product_id: pick }, (d) => setStage(nextAfterProduct(d)))}>Confirm Product</button>
            <button disabled={busy} className="text-xs text-gray-500 underline cursor-pointer"
              onClick={() => void step("decline", {}, () => { void loadRewardsHub(); onClose(); })}>None of these</button>
          </div>
        )}

        {stage === "consent" && (
          <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-4">
            <p className="text-sm text-gray-600">
              To share your review and earn ${reward}, please opt in to Nibbl and {String(overview?.brand_name ?? "the brand")}.
              This lets us publish your review on the brand&apos;s behalf. Your reward does not depend on your rating.
            </p>
            {Boolean(needs.nibbl) && (
              <label className="flex gap-2 items-start border border-gray-200 rounded-xl p-3 text-sm cursor-pointer">
                <input type="checkbox" checked={consent.nibbl} onChange={(e) => setConsent((c) => ({ ...c, nibbl: e.target.checked }))} className="mt-1" />
                <span>I agree to Nibbl&apos;s Terms of Service and Privacy Policy. <span className="text-gray-400">(Required)</span></span>
              </label>
            )}
            {Boolean(needs.brand) && (
              <label className="flex gap-2 items-start border border-gray-200 rounded-xl p-3 text-sm cursor-pointer">
                <input type="checkbox" checked={consent.brand} onChange={(e) => setConsent((c) => ({ ...c, brand: e.target.checked }))} className="mt-1" />
                <span>I agree to {String(overview?.brand_name ?? "the brand")}&apos;s marketing and review terms. <span className="text-gray-400">(Required)</span></span>
              </label>
            )}
            <p className="text-xs text-gray-500 bg-[#F0F8FB] rounded-lg p-3">If you&apos;ve already given consent in the past, we won&apos;t ask again.</p>
            <button disabled={busy || (Boolean(needs.nibbl) && !consent.nibbl) || (Boolean(needs.brand) && !consent.brand)} className={primary}
              onClick={() => void step("consent", { nibbl: consent.nibbl || !needs.nibbl, brand: consent.brand || !needs.brand }, () => setStage("voice"))}>
              Continue
            </button>
          </div>
        )}

        {stage === "voice" && (
          <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-4">
            <div className="flex gap-3 items-center">
              {image && <img src={image} alt="" className="w-24 h-24 object-contain" />}
              <ProductLine product={product} />
            </div>
            {[
              ["💲", `$${reward} reward`],
              ["⏳", `${String(overview?.days_left ?? 30)} days left`],
              ["⏱️", `About ${String(overview?.estimated_minutes ?? 2)} minutes`],
              ["💬", `${String(overview?.question_count ?? 5)} conversational questions based on this product.`],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-3 border border-gray-100 rounded-xl p-3 text-sm text-[#1F1D1D]">
                <span>{icon}</span>{text}
              </div>
            ))}
            <button className={primary} onClick={() => setStage("chat")}>Begin Review</button>
          </div>
        )}

        {stage === "chat" && (
          <>
            <div className="flex-grow p-4 overflow-y-auto flex flex-col gap-3 bg-gray-50/50">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} w-full`}>
                  <div className={`max-w-[75%] rounded-[14px] p-3 text-sm font-medium shadow-sm ${
                    m.role === "user" ? "bg-[#3E3EDF] text-white" : "bg-[#F0F8FB] text-[#1F1D1D]"}`}>
                    {m.content}
                  </div>
                </div>
              ))}

              {draft && (
                <div className="w-full flex flex-col gap-3 mt-2 animate-fade-in">
                  <div className="bg-white border border-gray-200 rounded-[12px] p-4 shadow-sm flex flex-col gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Final review — edit anything</span>
                    <div className="flex justify-between text-xs text-gray-500"><span>Review Title</span><span>{draft.title.length}/{TITLE_MAX}</span></div>
                    <input value={draft.title} maxLength={TITLE_MAX} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      className="w-full p-2 text-sm font-semibold border rounded focus:outline-none focus:ring-1 focus:ring-[#3E3EDF]" />
                    <div className="flex justify-between text-xs text-gray-500"><span>Review Body</span><span>{draft.content.length}/{BODY_MAX}</span></div>
                    <textarea value={draft.content} maxLength={BODY_MAX} onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                      className="w-full h-28 p-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-[#3E3EDF]" />
                    <button onClick={() => void regenerate()} disabled={busy}
                      className="self-end text-[#3E3EDF] text-sm hover:underline cursor-pointer font-medium disabled:opacity-50">
                      Regenerate from my answers
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-gray-700">How would you rate this product overall?</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => setRating(star)} aria-label={`${star} stars`}
                          className={`text-3xl leading-none cursor-pointer ${star <= rating ? "text-[#FFB701]" : "text-gray-300"}`}>★</button>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">You&apos;ll always receive ${reward} for your honest review — no matter your rating.</span>
                  </div>
                  <label className="flex gap-2 items-start text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
                    <span>
                      This accurately reflects my experience. It will be shown with my first name and last initial,
                      marked as a verified purchase that received a ${reward} reward.
                    </span>
                  </label>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="p-4 border-t border-gray-100 bg-white flex flex-col gap-2">
              {!draft ? (
                <>
                  {suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((s) => (
                        <button key={s} disabled={busy} onClick={() => void sendAnswer(s)}
                          className="px-4 py-1.5 rounded-full border border-[#3E3EDF] text-[#3E3EDF] text-sm font-medium disabled:opacity-50 cursor-pointer">{s}</button>
                      ))}
                    </div>
                  )}
                  <div className="w-full flex items-center bg-white border border-[#E0E0E0] rounded-[12px] px-[17px] py-[8px]">
                    <input type="text" value={inputText} disabled={busy || !messages.length}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void sendAnswer(); }}
                      placeholder="Type your answer…"
                      className="flex-grow bg-transparent border-none text-[#1F1D1D] text-[14px] focus:outline-none placeholder-gray-400 py-1" />
                    <button onClick={() => void sendAnswer()} disabled={busy || !inputText.trim()} aria-label="Send"
                      className="w-8 h-8 rounded-full bg-[#3E3EDF] hover:bg-[#3232c7] text-white flex items-center justify-center cursor-pointer ml-2 flex-shrink-0 disabled:opacity-50">
                      <svg className="w-4 h-4 transform rotate-90" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <button onClick={() => void submit()} disabled={busy} className={`${primary} shadow-md`}>
                  {busy ? "Submitting…" : `Submit Review & Get $${reward}`}
                </button>
              )}
            </div>
          </>
        )}
        {error && <p className="text-center text-xs font-medium text-[#E65353] pb-3">{error}</p>}
      </div>
    </div>
  );
}
