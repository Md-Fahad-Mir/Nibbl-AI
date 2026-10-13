"use client";

import { useEffect, useState } from "react";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";
import { referralLink } from "@/lib/referral";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";
import { displayOffer } from "@/features/homepage/lib/offerMappers";
import { X } from "lucide-react";

interface InviteFriendsCardProps {
  onInviteClick: () => void;
}

const HOW_IT_WORKS = [
  "New shopper joins through your link",
  "Claims an offer",
  "Redeems with an approved receipt",
  "Connects a payout method and completes a successful withdrawal",
];

const money = (value: unknown) => `$${Number(value ?? 0).toFixed(Number(value ?? 0) % 1 ? 2 : 0)}`;
const shortName = (name: unknown) => {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || "Friend";
};

const share = async (url: string, text: string, onCopied: () => void) => {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: "Nibbl", text, url });
      return;
    } catch {
      // Cancelled or unsupported — fall back to copying.
    }
  }
  await navigator.clipboard.writeText(`${text} ${url}`);
  onCopied();
};

/** Master "Refer a Friend": referral code + link, share a product deal, track
 *  each friend's progress (all steps within the window), and the rules. */
export default function InviteFriendsCard({ onInviteClick }: InviteFriendsCardProps) {
  const [overview, setOverview] = useState<ApiRecord | null>(null);
  const [toast, setToast] = useState("");
  const [sheet, setSheet] = useState<"products" | "rules" | null>(null);
  const offers = useConsumerApiStore((s) => s.offers);

  useEffect(() => {
    let live = true;
    nibblApi.referrals().then((data) => live && setOverview(data)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const code = String(overview?.referral_code ?? "");
  const link = code ? referralLink(code) : "";
  const reward = money(overview?.reward_amount ?? 5);
  const windowDays = Number(overview?.window_days ?? 90);
  const summary = (overview?.summary ?? {}) as ApiRecord;
  const friends = (Array.isArray(overview?.referrals) ? overview.referrals : []) as ApiRecord[];
  const message = `Find cash-back deals and verified review opportunities on Nibbl. Join with my link:`;

  const flash = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 1800);
  };

  return (
    <section className="w-full max-w-[669px] bg-[#FEFEFE] shadow-[0px_4px_6.5px_rgba(0,0,0,0.25)] rounded-[12px] p-5 sm:p-6 flex flex-col gap-4 border border-gray-100">
      <div className="rounded-[10px] bg-[#EEF0FF] p-4 flex flex-col gap-1">
        <span className="text-[22px] font-semibold text-[#1F1D1D]">Give Nibbl. Get {reward}.</span>
        <span className="text-[14px] text-[#575757]">Earn {reward} when a new shopper completes their first Nibbl journey.</span>
      </div>

      {code && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-[#575757]">Your referral code</span>
          <div className="flex items-center justify-between border border-gray-200 rounded-[8px] px-3 py-2">
            <span className="text-[18px] font-semibold tracking-[0.15em] text-[#3E3EDF]">{code}</span>
            <button onClick={() => void navigator.clipboard.writeText(code).then(() => flash("Code copied"))}
              className="text-[13px] font-semibold text-[#3E3EDF] cursor-pointer">Copy</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => void share(link, message, () => flash("Link copied"))}
              className="h-11 rounded-[8px] bg-[#3E3EDF] text-white text-[14px] font-medium cursor-pointer">
              Share referral link
            </button>
            <button onClick={() => setSheet("products")}
              className="h-11 rounded-[8px] border border-[#3E3EDF] text-[#3E3EDF] text-[14px] font-medium cursor-pointer">
              Share a product
            </button>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#8A8A8A]">
            <span className="truncate">{link}</span>
            <button onClick={() => void navigator.clipboard.writeText(link).then(() => flash("Link copied"))}
              className="text-[#3E3EDF] font-semibold cursor-pointer whitespace-nowrap">Copy link</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[14px] font-semibold text-[#2D2D2D]">How it works</span>
        <ol className="flex flex-col gap-1.5">
          {HOW_IT_WORKS.map((step, i) => (
            <li key={step} className="flex items-center gap-2 text-[13px] text-[#575757]">
              <span className="w-5 h-5 rounded-full bg-[#3E3EDF] text-white text-[11px] flex items-center justify-center flex-shrink-0">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <p className="text-[12px] text-[#575757] bg-[#F6F6FB] rounded-[8px] p-2">
          Your {reward} is added to your Wallet after all steps are complete — within {windowDays} days.
        </p>
        <div className="flex gap-4">
          <button onClick={() => setSheet("rules")} className="self-start text-[13px] text-[#3E3EDF] cursor-pointer">See referral rules</button>
          <button onClick={onInviteClick} className="self-start text-[13px] text-[#3E3EDF] cursor-pointer">Invite a friend by email</button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-[16px] font-semibold text-[#2D2D2D]">My referrals</span>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Earned", money(summary.earned ?? 0), "Added to Wallet"],
            ["Pending", money(summary.pending ?? 0), "In progress"],
            ["Invited", String(summary.invited ?? friends.length), "Total friends"],
          ].map(([label, value, note]) => (
            <div key={label} className="rounded-[10px] bg-[#F6F6FB] p-3 text-center">
              <div className="text-[20px] font-semibold text-[#1F1D1D]">{value}</div>
              <div className="text-[13px] font-medium text-[#2D2D2D]">{label}</div>
              <div className="text-[11px] text-[#8A8A8A]">{note}</div>
            </div>
          ))}
        </div>
        {friends.map((friend) => {
          const steps = (Array.isArray(friend.steps) ? friend.steps : []) as ApiRecord[];
          const after = steps.slice(1); // "Joined" is step zero; Master shows Step X of 4
          const done = after.filter((s) => s.done).length;
          const next = after.find((s) => !s.done);
          const status = String(friend.status ?? "");
          return (
            <div key={String(friend.id)} className="flex items-center gap-3 border border-gray-100 rounded-[8px] p-3">
              <span className="w-9 h-9 rounded-full bg-[#EEF0FF] text-[#3E3EDF] font-semibold flex items-center justify-center flex-shrink-0">
                {shortName(friend.full_name)[0]}
              </span>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-[14px] font-medium text-[#2D2D2D]">{shortName(friend.full_name)}</span>
                {status === "paid" ? (
                  <span className="self-start text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#E6F7F0] text-[#00875A]">Earned</span>
                ) : status === "rejected" || status === "expired" ? (
                  <>
                    <span className="self-start text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-[#575757]">Not eligible</span>
                    {Boolean(friend.decision_reason) && <span className="text-[12px] text-[#8A8A8A]">{String(friend.decision_reason)}</span>}
                  </>
                ) : status === "in_review" ? (
                  <span className="self-start text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EEF0FF] text-[#3E3EDF]">Being reviewed</span>
                ) : (
                  <>
                    <span className="self-start text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#FFF4E0] text-[#B26A00]">
                      Step {Math.min(done + 1, 4)} of 4
                    </span>
                    {next && <span className="text-[12px] text-[#8A8A8A]">Next: {String(next.label).toLowerCase()}</span>}
                  </>
                )}
              </div>
              <div className="text-right text-[12px] text-[#8A8A8A]">
                {status === "paid" ? (
                  <span className="text-[14px] font-semibold text-[#00875A]">+{money(friend.reward_amount)}</span>
                ) : friend.days_left != null ? (
                  `Expires in ${String(friend.days_left)} days`
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {toast && <p className="text-center text-[13px] text-[#00875A]">{toast}</p>}

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSheet(null)}>
          <div className="w-full max-w-[440px] max-h-[85vh] overflow-y-auto bg-white rounded-[16px] p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-[18px] font-semibold text-[#1F1D1D]">{sheet === "rules" ? "Referral Rules" : "Share a Product"}</h3>
              <button onClick={() => setSheet(null)} aria-label="Close" className="text-[#8A8A8A] cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            {sheet === "rules" ? (
              <>
                <ul className="flex flex-col gap-2 text-[14px] text-[#575757] list-disc pl-5">
                  <li>Referral reward: {reward}.</li>
                  <li>Only new Nibbl shoppers qualify.</li>
                  <li>They must join through your referral or product link.</li>
                  <li>They must claim, redeem with an approved receipt, connect a payout method, and complete a successful withdrawal within {windowDays} days.</li>
                  <li>Your reward is added to your Wallet after completion.</li>
                  <li>Referral rewards are added to your Wallet and follow the same payout process as other rewards.</li>
                  <li>Duplicate, self-referred, or suspicious accounts may be reviewed or disqualified.</li>
                </ul>
                <button onClick={() => setSheet(null)} className="h-11 rounded-[10px] bg-[#3E3EDF] text-white text-[15px] font-medium cursor-pointer">Got it</button>
              </>
            ) : (
              <>
                <p className="text-[13px] text-[#575757] bg-[#F6F6FB] rounded-[8px] p-3">
                  Your referral code is automatically included in the product link. Offer availability is checked when your friend opens the link.
                </p>
                {offers.length === 0 && <p className="text-[14px] text-[#8A8A8A]">Open For You to load offers near you, then share one here.</p>}
                {offers.slice(0, 24).map((offer) => {
                  const d = displayOffer(offer);
                  const id = String(offer.campaign_id ?? offer.id ?? "");
                  return (
                    <div key={id} className="flex items-center gap-3 border border-gray-100 rounded-[10px] p-3">
                      {d.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.image} alt="" className="w-14 h-14 rounded-[8px] object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-[#8A8A8A]">{d.brand}</div>
                        <div className="text-[14px] font-medium text-[#1F1D1D] truncate">{d.headline || d.title}</div>
                        <div className="text-[12px] text-[#3E3EDF]">{d.rewardLabel}</div>
                      </div>
                      <button onClick={() => void share(referralLink(code, id), `Check out this deal on Nibbl: ${d.headline || d.title}.`, () => flash("Deal link copied"))}
                        className="h-9 px-3 rounded-[8px] bg-[#3E3EDF] text-white text-[13px] font-medium cursor-pointer whitespace-nowrap">
                        Share deal
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
