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

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

/** AI chat review (Master #24): the backend asks the questions, writes a
 *  draft from the answers, and the shopper edits, rates and approves it.
 *  The $1 reward is paid on submit for every rating. */
export default function ReviewChatModal({ opportunity, onClose, onSubmitted }: ReviewChatModalProps) {
  const sessionId = String(opportunity.id ?? "");
  const productName = String(opportunity.product_name || "this product");
  const reward = Number(opportunity.reward_amount ?? 1).toFixed(2);
  const submitReview = useConsumerApiStore((state) => state.submitReview);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<{ title: string; content: string } | null>(null);
  const [inputText, setInputText] = useState("");
  const [rating, setRating] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Opening the session plans the conversation and asks the first question.
  useEffect(() => {
    let live = true;
    nibblApi
      .reviewSession(sessionId)
      .then((session) => {
        if (!live) return;
        const history = (Array.isArray(session.messages) ? session.messages : []) as ChatMessage[];
        const prompts = Array.isArray(session.prompts) ? session.prompts : [];
        const answered = history.filter((m) => m.role === "user").length;
        setMessages(history);
        if (prompts.length && answered >= prompts.length) {
          setDraft({ title: String(session.ai_review_title ?? ""), content: String(session.ai_review_content ?? "") });
        }
      })
      .catch((err) => live && setError(errorText(err, "Could not open this review.")))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, draft]);

  const sendAnswer = async () => {
    const text = inputText.trim();
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
    if (!confirmed) return setError("Confirm the review reflects your honest experience.");
    setBusy(true);
    setError(null);
    try {
      await submitReview(sessionId, {
        rating,
        title: draft.title.trim(),
        content: draft.content.trim(),
        would_recommend: wouldRecommend,
      });
      onSubmitted(productName, reward);
    } catch (err) {
      setError(errorText(err, "Could not submit review."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-[500px] h-[85vh] min-h-[550px] bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden relative border border-gray-100">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-gray-800 truncate max-w-[340px]">Review: {productName}</span>
            <span className="text-xs text-gray-500">Earn ${reward} for an honest review</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-2xl font-bold cursor-pointer">
            &times;
          </button>
        </div>

        <div className="flex-grow p-4 overflow-y-auto flex flex-col gap-3 bg-gray-50/50">
          {loading && <p className="text-sm text-gray-500 text-center mt-6">Loading your review…</p>}
          {messages.map((m, idx) => (
            <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} w-full`}>
              <div
                className={`max-w-[75%] rounded-[14px] p-3 text-sm font-medium shadow-sm ${
                  m.role === "user" ? "bg-[#3E3EDF] text-white" : "bg-[#F0F8FB] text-[#1F1D1D]"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {draft && (
            <div className="w-full flex flex-col gap-3 mt-2 animate-fade-in">
              <div className="bg-white border border-gray-200 rounded-[12px] p-4 shadow-sm flex flex-col gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your review — edit anything</span>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Title"
                  maxLength={255}
                  className="w-full p-2 text-sm font-semibold border rounded focus:outline-none focus:ring-1 focus:ring-[#3E3EDF]"
                />
                <textarea
                  value={draft.content}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  className="w-full h-28 p-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-[#3E3EDF]"
                />
                <button onClick={regenerate} disabled={busy}
                  className="self-end text-[#3E3EDF] text-sm hover:underline cursor-pointer font-medium disabled:opacity-50">
                  Regenerate
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-gray-700">Your rating</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setRating(star)} aria-label={`${star} stars`}
                      className={`text-3xl leading-none cursor-pointer ${star <= rating ? "text-[#FFB701]" : "text-gray-300"}`}>
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-700">Would you buy it again or recommend it?</span>
                <div className="flex gap-3">
                  {[true, false].map((value) => (
                    <button key={String(value)} onClick={() => setWouldRecommend(value)}
                      className={`flex-1 py-2 text-sm border rounded-lg cursor-pointer font-medium ${
                        wouldRecommend === value ? "bg-blue-50 border-[#3E3EDF] text-[#3E3EDF]" : "bg-white border-gray-300 text-gray-700"
                      }`}>
                      {value ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex gap-2 items-start text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
                <span>
                  This review reflects my honest experience. It will be shown with my first name and last initial,
                  marked as a verified purchase that received a ${reward} reward.
                </span>
              </label>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-gray-100 bg-white flex flex-col gap-2">
          {!draft ? (
            <div className="w-full flex items-center bg-white border border-[#E0E0E0] rounded-[12px] shadow-[0px_4px_4px_rgba(0,0,0,0.04)] px-[17px] py-[8px]">
              <input
                type="text"
                value={inputText}
                disabled={loading || busy || !messages.length}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendAnswer();
                }}
                placeholder="Type your answer…"
                className="flex-grow bg-transparent border-none text-[#1F1D1D] text-[14px] focus:outline-none placeholder-gray-400 py-1"
              />
              <button onClick={() => void sendAnswer()} disabled={busy || !inputText.trim()} aria-label="Send"
                className="w-8 h-8 rounded-full bg-[#3E3EDF] hover:bg-[#3232c7] text-white flex items-center justify-center cursor-pointer ml-2 flex-shrink-0 disabled:opacity-50">
                <svg className="w-4 h-4 transform rotate-90" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
              </button>
            </div>
          ) : (
            <button onClick={() => void submit()} disabled={busy}
              className="w-full py-3 bg-[#3E3EDF] text-white text-sm font-semibold rounded-lg hover:bg-[#3232c7] disabled:opacity-60 cursor-pointer shadow-md">
              {busy ? "Submitting…" : `Submit Review & Get $${reward}`}
            </button>
          )}
          {error && <p className="text-center text-xs font-medium text-[#E65353]">{error}</p>}
        </div>
      </div>
    </div>
  );
}
