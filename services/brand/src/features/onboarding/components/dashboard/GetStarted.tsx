"use client";

import { useState } from "react";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { toNumber } from "../../utils/backendMappers";

const GOALS = [
  { id: "rebate", label: "Win new customers", detail: "Rebate offers that reward a verified purchase.", tab: "Rebate" },
  { id: "reviews", label: "Get verified reviews", detail: "$1 AI-assisted reviews from verified buyers.", tab: "Reviews" },
] as const;

const storageKey = (brandId: string) => `nibbl-growth-goal:${brandId}`;
const readGoal = (brandId: string) => {
  try {
    return localStorage.getItem(storageKey(brandId)) ?? "";
  } catch {
    return "";
  }
};

/** Master "Dashboard & Wallet Setup": first growth goal → campaign setup →
 *  wallet funding before launch. Hidden once a campaign is live. */
export default function GetStarted({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const brandId = useBrandApiStore((s) => s.selectedBrandId) ?? "";
  const products = useBrandApiStore((s) => s.products);
  const campaigns = useBrandApiStore((s) => s.campaigns);
  const reviewCampaigns = useBrandApiStore((s) => s.reviewCampaigns);
  const wallet = useBrandApiStore((s) => s.wallet);
  const [goal, setGoal] = useState(() => readGoal(brandId));

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
    { label: "Add your products", done: products.length > 0, action: "Product Library", cta: "Add products" },
    {
      label: chosen?.id === "reviews" ? "Create your first review campaign" : "Create your first rebate campaign",
      done: goalCampaigns.some((c) => c.status !== "archived"),
      action: chosen?.tab ?? "Rebate",
      cta: "Set up campaign",
    },
    {
      label: "Fund your wallet",
      done: toNumber(wallet?.reward_available ?? wallet?.available) > 0,
      action: "Wallet",
      cta: "Add funds",
    },
    {
      label: chosen?.id === "reviews" ? "Activate your review campaign" : "Submit for Nibbl approval and go live",
      done: false,
      action: chosen?.tab ?? "Rebate",
      cta: "Open campaigns",
    },
  ];

  return (
    <section className="bg-white border border-[#EAEDFF] rounded-[24px] p-6 shadow-sm flex flex-col gap-5 font-manrope">
      <div>
        <h2 className="font-jakarta font-extrabold text-lg text-[#131B2E]">Get ready to launch</h2>
        <p className="text-sm text-[#454656] mt-1">Choose your first growth goal, set up a campaign and fund your wallet.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {GOALS.map((option) => (
          <button key={option.id} type="button" onClick={() => choose(option.id)}
            className={`text-left rounded-2xl border p-4 cursor-pointer ${
              goal === option.id ? "border-[#001BD2] bg-[#F2F3FF]" : "border-slate-200"
            }`}>
            <div className="text-sm font-extrabold text-[#131B2E]">{option.label}</div>
            <div className="text-xs text-[#454656] mt-1">{option.detail}</div>
          </button>
        ))}
      </div>

      {chosen && (
        <ol className="flex flex-col divide-y divide-[#F1F2FA] border border-[#F1F2FA] rounded-2xl">
          {steps.map((step, index) => (
            <li key={step.label} className="flex items-center gap-3 px-4 py-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step.done ? "bg-emerald-100 text-emerald-700" : "bg-[#F2F3FF] text-[#001BD2]"
              }`}>
                {step.done ? "✓" : index + 1}
              </span>
              <span className={`flex-1 text-sm font-semibold ${step.done ? "text-[#94A3B8] line-through" : "text-[#131B2E]"}`}>
                {step.label}
              </span>
              {!step.done && (
                <button type="button" onClick={() => onNavigate(step.action)}
                  className="text-xs font-bold text-[#001BD2] cursor-pointer">
                  {step.cta} →
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
