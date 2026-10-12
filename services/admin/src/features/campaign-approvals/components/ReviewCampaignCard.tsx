/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";

type Action = "approve" | "request_changes" | "reject";

const day = (value: unknown) =>
  value ? new Date(String(value)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

/** One review campaign waiting for Nibbl review (Master: "Campaign will be
 *  published after Nibbl review"). */
export const ReviewCampaignCard = ({ campaign, onDecided }: { campaign: ApiRecord; onDecided: (msg: string) => void }) => {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const products = (Array.isArray(campaign.products) ? campaign.products : []) as ApiRecord[];
  const prompts = (Array.isArray(campaign.prompts) ? campaign.prompts : []) as ApiRecord[];

  const decide = async (action: Action) => {
    setError("");
    if (action !== "approve" && !comment.trim()) return setError("Add a comment for the brand first.");
    setBusy(action);
    try {
      await nibblApi.decideReviewCampaign(String(campaign.id), action, comment.trim());
      onDecided(`${String(campaign.name)} ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "sent back for changes"}.`);
    } catch (err) {
      setError((err as Error).message || "Could not save the decision.");
    } finally {
      setBusy(null);
    }
  };

  const cooldown = campaign.one_time_only
    ? "One time"
    : Number(campaign.product_cooldown_days) ? `${String(campaign.product_cooldown_days)} days` : "None";

  return (
    <div className="bg-white border border-[#ECECF5] rounded-2xl p-6 shadow-sm flex flex-col gap-4">
      <div className="flex gap-4">
        {campaign.image_url ? <img src={String(campaign.image_url)} alt="" className="w-20 h-20 rounded-xl object-cover" /> : null}
        <div>
          <p className="text-xs font-semibold text-[#3E3EDF] uppercase tracking-wider">{String(campaign.brand_name ?? "")}</p>
          <h2 className="text-lg font-bold text-[#1A1A2E]">{String(campaign.name)}</h2>
          <p className="text-xs text-[#6B6B80]">Review campaign · submitted {day(campaign.submitted_at)}</p>
        </div>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {[
          ["Dates", `${day(campaign.start_at)} – ${campaign.end_at ? day(campaign.end_at) : "no end date"}`],
          ["Opportunities per day", String(campaign.daily_opportunities)],
          ["Product cooldown", cooldown],
          ["Cost per completed review", `$1.00 reward + $${String(campaign.review_fee ?? "0.00")} ${String(campaign.plan ?? "")} plan fee`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-[#F6F6FB] py-1">
            <dt className="text-[#6B6B80]">{k}</dt><dd className="font-semibold text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="text-xs font-semibold text-[#6B6B80] mb-1">Eligible products</p>
        <div className="flex flex-wrap gap-2">
          {products.map((p) => (
            <span key={String(p.id)} className="text-xs bg-[#F6F6FB] rounded-full px-3 py-1">
              {[p.name, p.flavor, p.size_label, p.code].filter(Boolean).map(String).join(" · ")}
            </span>
          ))}
        </div>
      </div>
      {prompts.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#6B6B80] mb-1">Brand questions</p>
          <ul className="list-disc pl-5 text-sm text-[#454656]">{prompts.map((p) => <li key={String(p.id)}>{String(p.text)}</li>)}</ul>
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
      <textarea value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder="Comment for the brand (required to request changes or reject)"
        className="w-full min-h-20 px-3 py-2 rounded-lg border border-[#E0E0F0] text-sm outline-none focus:border-[#3E3EDF]" />
      <div className="flex flex-wrap gap-3">
        <button onClick={() => void decide("approve")} disabled={busy !== null}
          className="h-10 px-5 bg-[#3E3EDF] text-white font-semibold text-sm rounded-full disabled:opacity-50 cursor-pointer">
          {busy === "approve" ? "Approving…" : "Approve"}</button>
        <button onClick={() => void decide("request_changes")} disabled={busy !== null}
          className="h-10 px-5 border border-[#3E3EDF] text-[#3E3EDF] font-semibold text-sm rounded-full disabled:opacity-50 cursor-pointer">
          {busy === "request_changes" ? "Sending…" : "Request changes"}</button>
        <button onClick={() => void decide("reject")} disabled={busy !== null}
          className="h-10 px-5 border border-red-200 text-red-600 font-semibold text-sm rounded-full disabled:opacity-50 cursor-pointer">
          {busy === "reject" ? "Rejecting…" : "Reject"}</button>
      </div>
    </div>
  );
};
