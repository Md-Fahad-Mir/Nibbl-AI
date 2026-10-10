"use client";

import { useEffect, useState } from "react";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";
import { referralLink } from "@/lib/referral";

interface InviteFriendsCardProps {
  onInviteClick: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
  in_review: "Being reviewed",
  paid: "Reward paid",
  rejected: "Not eligible",
};

/** Master "Refer a Friend": share a referral link and track each friend's
 *  qualification progress. */
export default function InviteFriendsCard({ onInviteClick }: InviteFriendsCardProps) {
  const [overview, setOverview] = useState<ApiRecord | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    nibblApi.referrals().then((data) => live && setOverview(data)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const code = String(overview?.referral_code ?? "");
  const link = code ? referralLink(code) : "";
  const friends = (Array.isArray(overview?.referrals) ? overview.referrals : []) as ApiRecord[];

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="w-full max-w-[669px] bg-[#FEFEFE] shadow-[0px_4px_6.5px_rgba(0,0,0,0.25)] rounded-[12px] p-6 sm:py-[12px] sm:px-[18px] flex flex-col items-center gap-[14px] border border-gray-100">
      <div className="flex flex-col items-center gap-[4px] w-full text-center">
        <span className="text-[20px] font-medium leading-[24px] text-[#2D2D2D]">Invite Friends, Earn $5</span>
        <span className="text-[14px] sm:text-[16px] font-normal leading-[19px] text-[#575757] max-w-[420px] mx-auto mt-0.5">
          You earn $5 after your friend joins with your link, claims an offer, gets a redemption approved, connects a
          payout method and completes a withdrawal.
        </span>
      </div>

      {link && (
        <div className="w-full flex items-center gap-2 border border-gray-200 rounded-[8px] px-3 py-2">
          <span className="flex-1 text-[13px] text-[#575757] truncate">{link}</span>
          <button onClick={() => void copy()} className="text-[13px] font-semibold text-[#3E3EDF] cursor-pointer">
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}

      <button
        onClick={onInviteClick}
        className="w-full max-w-[609px] h-[54px] bg-gradient-to-t from-[#3E3EDF] to-[#3E3EDF] hover:opacity-95 active:scale-[0.99] transition-all text-white text-[18px] font-medium rounded-[8px] flex items-center justify-center cursor-pointer focus:outline-none shadow-[0px_4px_4px_rgba(0,0,0,0.12),_inset_0px_4px_4px_rgba(255,255,255,0.12)]"
      >
        Invite a friend by email
      </button>

      {friends.length > 0 && (
        <div className="w-full flex flex-col gap-3 mt-1">
          <span className="text-[14px] font-semibold text-[#2D2D2D]">Your referrals</span>
          {friends.map((friend) => {
            const steps = (Array.isArray(friend.steps) ? friend.steps : []) as ApiRecord[];
            const done = steps.filter((s) => s.done).length;
            return (
              <div key={String(friend.id)} className="w-full border border-gray-100 rounded-[8px] p-3 flex flex-col gap-2">
                <div className="flex justify-between text-[14px]">
                  <span className="font-medium text-[#2D2D2D]">{String(friend.full_name)}</span>
                  <span className="text-[#575757]">{STATUS_LABEL[String(friend.status)] ?? "In progress"}</span>
                </div>
                <div className="flex gap-1">
                  {steps.map((s) => (
                    <span key={String(s.key)} title={String(s.label)}
                      className={`h-1.5 flex-1 rounded-full ${s.done ? "bg-[#00A671]" : "bg-gray-200"}`} />
                  ))}
                </div>
                <span className="text-[12px] text-[#8A8A8A]">
                  {friend.status === "rejected" && friend.decision_reason
                    ? String(friend.decision_reason)
                    : `${done} of ${steps.length || 5} steps done${
                        steps.find((s) => !s.done) ? ` — next: ${String(steps.find((s) => !s.done)?.label).toLowerCase()}` : ""
                      }`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
