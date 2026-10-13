"use client";

import { useEffect, useState } from "react";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatMoney } from "../../utils/backendMappers";
import { Check, HeartHandshake, type LucideIcon, Star, TrendingUp, Users } from "lucide-react";

export const ACTIVATED_KEY = "nibbl-just-activated";

const TOOLKIT: [LucideIcon, string, string][] = [
  [Users, "Acquire new customers", "Reach new shoppers with verified offers."],
  [HeartHandshake, "Reconnect with opted-in customers", "Bring shoppers back with new campaigns."],
  [TrendingUp, "Build repeat engagement", "Run products and rebates to drive loyalty."],
  [Star, "Generate verified reviews", "Collect authentic shopper feedback."],
];
const STEPS = [
  "Add your first product",
  "Create a rebate or review campaign",
  "Set campaign pacing and cooldowns",
  "Fund your Wallet and enable auto-replenishment",
  "Submit your campaign for Nibbl review",
];

/** Master onboarding ⑨ "Account Activated" — shown once after checkout. */
export default function AccountActivated({ onDone, onBilling }: { onDone: () => void; onBilling: () => void }) {
  const brand = useBrandApiStore((s) => s.brand);
  const wallet = useBrandApiStore((s) => s.wallet);
  const loadSavedCards = useBrandApiStore((s) => s.loadSavedCards);
  const [last4, setLast4] = useState("");
  const plan = (brand?.plan ?? {}) as Record<string, unknown>;

  useEffect(() => {
    let live = true;
    loadSavedCards().then((cards) => live && setLast4(String(cards[0]?.last4 ?? ""))).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [loadSavedCards]);

  const tiles = [
    [`${String(plan.name ?? "Your")} Plan`, "active"],
    [String(plan.max_active_campaigns ?? "—"), "campaign slots"],
    [formatMoney(wallet?.promotional ?? 0), "promotional credits"],
    ["Payment method", last4 ? `ending ${last4}` : "saved"],
  ];

  return (
    <div className="w-full max-w-[960px] mx-auto flex flex-col gap-6 font-manrope text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center"><Check className="w-8 h-8" /></span>
        <h1 className="font-jakarta text-3xl font-extrabold text-[#131B2E]">Welcome to Nibbl, {String(brand?.name ?? "")}</h1>
        <p className="text-sm text-[#454656] max-w-[520px]">
          Your {String(plan.name ?? "")} plan is active. You can now add products, create campaigns, and explore your dashboard.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(([value, label]) => (
          <div key={label} className="bg-white border border-[#EAEDFF] rounded-2xl p-4">
            <div className="font-jakarta font-extrabold text-[#131B2E]">{value}</div>
            <div className="text-xs text-[#64748B]">{label}</div>
          </div>
        ))}
      </div>
      <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-5 text-left flex flex-col gap-3">
        <h2 className="font-jakarta font-bold text-[#131B2E]">Your growth toolkit</h2>
        <p className="text-xs text-[#64748B] -mt-2">Tools to help you drive trial, velocity, and shopper engagement.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TOOLKIT.map(([Icon, title, text]) => (
            <div key={title} className="border border-[#F1F2FA] rounded-xl p-3">
              <Icon className="w-6 h-6 text-[#001BD2]" />
              <div className="text-sm font-bold text-[#131B2E] mt-1">{title}</div>
              <div className="text-xs text-[#64748B]">{text}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-5 text-left flex flex-col gap-3">
        <h2 className="font-jakarta font-bold text-[#131B2E]">Getting Started</h2>
        <p className="text-xs text-[#64748B] -mt-2">Complete these steps to launch your first campaign.</p>
        <ol className="flex flex-col gap-2">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-3 text-sm text-[#131B2E]">
              <span className="w-6 h-6 rounded-full bg-[#001BD2] text-white text-xs flex items-center justify-center">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <button type="button" onClick={onDone} className="h-12 rounded-full bg-[#001BD2] text-white font-bold text-sm cursor-pointer">
          Enter Dashboard
        </button>
        <button type="button" onClick={onBilling} className="text-xs font-bold text-[#454656] underline cursor-pointer">
          Review billing details
        </button>
      </section>
    </div>
  );
}
