"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { ApiRecord } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

type Question = { text: string; suggestions: string[] };
type Line = { role: "ai" | "you"; text: string };

/** Master "Test review chat": the brand walks through the same planned
 *  conversation and AI draft a shopper gets. Nothing is saved or paid. */
export default function TestReviewChatModal({ campaignId, products, onClose }: {
  campaignId: string;
  products: ApiRecord[];
  onClose: () => void;
}) {
  const testReviewChat = useBrandApiStore((s) => s.testReviewChat);
  const [productId, setProductId] = useState(String(products[0]?.id ?? ""));
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<{ title: string; review: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    testReviewChat(campaignId, { product_id: productId || undefined })
      .then((plan) => {
        if (!live) return;
        const qs = (Array.isArray(plan.questions) ? plan.questions : []) as Question[];
        setQuestions(qs);
        setAnswers([]);
        setDraft(null);
        setError("");
        setLines(qs.length ? [{ role: "ai", text: qs[0].text }] : []);
      })
      .catch((err) => live && setError(err instanceof Error ? err.message : "Could not start the test chat."));
    return () => {
      live = false;
    };
  }, [campaignId, productId, testReviewChat]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, draft]);

  const current = questions[answers.length];

  const answer = async (value: string) => {
    const reply = value.trim();
    if (!reply || !current || busy) return;
    const nextAnswers = [...answers, reply];
    const next = questions[nextAnswers.length];
    setAnswers(nextAnswers);
    setText("");
    setLines((l) => [...l, { role: "you", text: reply }, ...(next ? [{ role: "ai" as const, text: next.text }] : [])]);
    if (next) return;
    setBusy(true);
    try {
      const result = await testReviewChat(campaignId, {
        product_id: productId,
        answers: questions.map((q, i) => ({ question: q.text, answer: nextAnswers[i] })),
      });
      setDraft({ title: String(result.title ?? ""), review: String(result.review ?? "") });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not write the draft.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-[460px] h-[min(720px,90vh)] bg-white rounded-[28px] flex flex-col overflow-hidden font-manrope"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EAEDFF]">
          <div>
            <h3 className="font-jakarta font-bold text-[#131B2E]">Test Review Chat</h3>
            <p className="text-[11px] text-[#64748B]">Preview only — nothing is saved or paid.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        {products.length > 1 && (
          <div className="px-5 pt-3">
            <select value={productId} onChange={(e) => setProductId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#E0E3F5] text-sm">
              {products.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {[p.name, p.flavor, p.size_label].filter(Boolean).map(String).join(" · ")}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {lines.map((line, i) => (
            <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              line.role === "ai" ? "self-start bg-[#F2F3FF] text-[#131B2E]" : "self-end bg-[#001BD2] text-white"}`}>
              {line.text}
            </div>
          ))}
          {busy && <p className="text-xs text-[#64748B]">Writing the draft review…</p>}
          {draft && (
            <div className="border border-[#EAEDFF] rounded-2xl p-4 flex flex-col gap-2">
              <span className="text-[11px] font-bold text-[#001BD2] uppercase tracking-wider">Draft review</span>
              <p className="font-bold text-[#131B2E]">{draft.title || "(no title)"} <span className="text-[10px] text-[#94A3B8]">{draft.title.length}/100</span></p>
              <p className="text-sm text-[#454656] whitespace-pre-line">{draft.review} <span className="text-[10px] text-[#94A3B8]">{draft.review.length}/500</span></p>
            </div>
          )}
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <div ref={endRef} />
        </div>
        {current && (
          <div className="border-t border-[#EAEDFF] px-5 py-3 flex flex-col gap-2">
            {current.suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {current.suggestions.map((s) => (
                  <button key={s} onClick={() => void answer(s)}
                    className="h-8 px-3 rounded-full border border-[#001BD2]/40 text-[#001BD2] text-xs font-bold cursor-pointer">{s}</button>
                ))}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); void answer(text); }} className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type an answer…"
                className="flex-1 h-10 px-4 rounded-full border border-[#E0E3F5] text-sm outline-none focus:border-[#001BD2]" />
              <button type="submit" aria-label="Send" className="w-10 h-10 rounded-full bg-[#001BD2] text-white flex items-center justify-center cursor-pointer">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
