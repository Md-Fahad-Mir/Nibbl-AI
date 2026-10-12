"use client";

import { useEffect, useState } from "react";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { toNumber } from "../../utils/backendMappers";

// Master "First Dashboard": three growth goals.
const GOALS = [
  { id: "acquire", icon: "👥", label: "Acquire New Customers", detail: "Reach new-to-brand shoppers with a rebate.", tab: "Rebate" },
  { id: "loyalty", icon: "💜", label: "Reconnect & Build Loyalty", detail: "Bring opted-in customers back with a relevant campaign.", tab: "Rebate" },
  { id: "reviews", icon: "⭐", label: "Generate Verified Reviews", detail: "Offer verified purchasers paid review opportunities, even without a rebate claim.", tab: "Reviews" },
] as const;

const storageKey = (brandId: string) => `nibbl-growth-goal:${brandId}`;
const readGoal = (brandId: string) => {
  try {
    return localStorage.getItem(storageKey(brandId)) ?? "";
  } catch {
    return "";
  }
};

/** Master "First Dashboard": choose the first growth goal, then the five
 *  steps to launch. Hidden once a campaign is live. */
export default function GetStarted({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const brandId = useBrandApiStore((s) => s.selectedBrandId) ?? "";
  const products = useBrandApiStore((s) => s.products);
  const campaigns = useBrandApiStore((s) => s.campaigns);
  const reviewCampaigns = useBrandApiStore((s) => s.reviewCampaigns);
  const wallet = useBrandApiStore((s) => s.wallet);
  const getAutoRefill = useBrandApiStore((s) => s.getAutoRefill);
  const [goal, setGoal] = useState(() => readGoal(brandId));
  const [autoRefillOn, setAutoRefillOn] = useState(false);

  useEffect(() => {
    let live = true;
    getAutoRefill().then((config) => live && setAutoRefillOn(Boolean(config.enabled))).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [getAutoRefill]);

  const all = [...campaigns, ...reviewCampaigns];
  if (all.some((c) => c.status === "active")) return null;

  const chosen = GOALS.find((g) => g.id === goal);
  const goalCampaigns = goal === "reviews" ? reviewCampaigns : campaigns;
  const choose = (id: string) => {
    setGoal(id);
    try {
      localStorage.setItem(storageKey(brandId), id);
    } catch {
      // Per-browser convenience only.
    }
  };

  const steps = [
    { label: "Add your first product", detail: "Add a product from your catalog to get started.",
      done: products.length > 0, action: "Product Library" },
    { label: "Choose your first campaign goal", detail: "Select the growth objective that fits your business needs.",
      done: Boolean(chosen), action: "" },
    { label: "Set pacing, eligibility, and cooldowns", detail: "Configure campaign rules and limits.",
      done: goalCampaigns.some((c) => c.status !== "archived"), action: chosen?.tab ?? "Rebate" },
    { label: "Fund Wallet and enable auto-replenishment", detail: "Add funds to your Wallet to cover shopper rewards.",
      done: toNumber(wallet?.reward_available ?? wallet?.available) > 0 && autoRefillOn, action: "Wallet" },
    { label: "Submit for Nibbl review", detail: "We'll review your campaign and notify you.",
      done: campaigns.some((c) => ["pending_review", "approved"].includes(String(c.review_status ?? ""))),
      action: chosen?.tab ?? "Rebate" },
  ];
  const next = steps.find((s) => !s.done);

  return (
    <section className="flex flex-col gap-5 font-manrope">
      <div className="bg-white border border-[#EAEDFF] rounded-[24px] p-6 shadow-sm flex flex-col gap-4">
        <div>
          <h2 className="font-jakarta font-extrabold text-lg text-[#131B2E]">Choose your first growth goal</h2>
          <p className="text-sm text-[#454656] mt-1">Select the objective that best fits your current business needs.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {GOALS.map((option) => (
            <button key={option.id} type="button" onClick={() => choose(option.id)}
              className={`text-center rounded-2xl border p-5 flex flex-col items-center gap-2 cursor-pointer ${
                goal === option.id ? "border-[#001BD2] bg-[#F2F3FF]" : "border-slate-200"
              }`}>
              <span className="text-3xl">{option.icon}</span>
              <span className="text-sm font-extrabold text-[#131B2E]">{option.label}</span>
              <span className="text-xs text-[#454656]">{option.detail}</span>
              <span className={`w-5 h-5 rounded-full border-2 ${goal === option.id ? "border-[#001BD2] bg-[#001BD2]" : "border-slate-300"}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#EAEDFF] rounded-[24px] p-6 shadow-sm flex flex-col gap-4">
        <h2 className="font-jakarta font-extrabold text-lg text-[#131B2E]">Complete these steps to launch your first campaign.</h2>
        <ol className="flex flex-col divide-y divide-[#F1F2FA] border border-[#F1F2FA] rounded-2xl">
          {steps.map((step, index) => (
            <li key={step.label}>
              <button type="button" disabled={!step.action} onClick={() => step.action && onNavigate(step.action)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer disabled:cursor-default">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  step.done ? "bg-emerald-100 text-emerald-700" : "bg-[#F2F3FF] text-[#001BD2]"
                }`}>
                  {step.done ? "✓" : index + 1}
                </span>
                <span className="flex-1">
                  <span className={`block text-sm font-semibold ${step.done ? "text-[#94A3B8] line-through" : "text-[#131B2E]"}`}>{step.label}</span>
                  <span className="block text-xs text-[#64748B]">{step.detail}</span>
                </span>
                {step.action && <span className="text-[#94A3B8]">›</span>}
              </button>
            </li>
          ))}
        </ol>
        {next?.action && (
          <button type="button" onClick={() => onNavigate(next.action)}
            className="h-12 rounded-full bg-[#001BD2] text-white font-bold text-sm cursor-pointer">
            {next.label}
          </button>
        )}
        <p className="text-xs text-[#64748B] bg-[#F8F9FF] rounded-xl p-3 text-center">ⓘ Start small. Adjust limits next cycle as you learn.</p>
      </div>
    </section>
  );
}
