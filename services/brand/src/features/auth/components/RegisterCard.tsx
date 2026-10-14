"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BarChart3, CheckCircle2, Rocket, Sprout, type LucideIcon } from "lucide-react";
import SignupSteps from "./SignupSteps";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";

// Master onboarding ⑤ Confirm Your Plan: who each plan is for.
const PLAN_COPY: Record<string, { Icon: LucideIcon; blurb: string }> = {
  starter: { Icon: Sprout, blurb: "Test customer acquisition and review campaigns." },
  pro: {
    Icon: BarChart3,
    blurb: "Built for brands ready to acquire new customers, reconnect with opted-in shoppers, build loyalty, and grow verified reviews.",
  },
  scale: { Icon: Rocket, blurb: "Run Nibbl as an always-on acquisition, loyalty and review channel." },
};

const CATEGORIES = ["Food & Drinks", "Health", "Beauty", "Home", "Kids", "Other"];

const inputClass =
  "w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:border-[#001BD2] focus:ring-1 focus:ring-[#001BD2] font-manrope placeholder-slate-400";
const labelClass = "flex flex-col gap-1.5 text-xs font-bold text-[#131B2E]";

const planBullets = (plan: ApiRecord) => [
  `Up to ${String(plan.max_active_campaigns)} active rebate campaign${Number(plan.max_active_campaigns) === 1 ? "" : "s"}`,
  `${Number(plan.rebate_fee_percent)}% fee on shopper rewards`,
  `$${(1 + Number(plan.review_fee ?? 0)).toFixed(0)} per completed review`,
  plan.data_access_level === "full" ? "Full opted-in customer contacts and CSV export" : "Limited customer identity",
];

/** Master brand onboarding ⑤ Confirm Your Plan and ⑥ Create Your Brand
 *  Account (⑦ Verify follows on /verify-email). */
export default function RegisterCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { registerAndApply, error, status } = useBrandApiStore();
  const [plans, setPlans] = useState<ApiRecord[]>([]);
  const [plan, setPlan] = useState(searchParams.get("plan") || "pro");
  const [step, setStep] = useState<1 | 2>(1);
  const [changingPlan, setChangingPlan] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [brandName, setBrandName] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let live = true;
    apiClient
      .request<ApiRecord[] | { results: ApiRecord[] }>(backendApi.billing.plans)
      .then((list) => live && setPlans(Array.isArray(list) ? list : list.results))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const selected = plans.find((p) => String(p.slug) === plan);
  const planName = String(selected?.name ?? plan.charAt(0).toUpperCase() + plan.slice(1));
  const copy = PLAN_COPY[plan] ?? PLAN_COPY.pro;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!accepted) {
      setFormError("Accept the terms and privacy policy to continue.");
      return;
    }
    try {
      await registerAndApply({
        fullName,
        email,
        brandName,
        website,
        phone,
        officeLocation: "",
        category,
        plan,
      });
      router.push(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch {
      // Store keeps the displayable error.
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF8FF] flex items-start justify-center p-4 py-10 md:py-16 font-jakarta">
      <div className="w-full max-w-[520px] bg-white rounded-3xl shadow-xl p-6 md:p-10 flex flex-col gap-7 border border-slate-100/50 animate-slide-up">
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-[120px] h-[44px]">
            <Image src="/Auth/LogoImage.svg" alt="NibblAI Logo" fill className="object-contain object-left" priority />
          </div>
          <span className="text-xs font-manrope text-[#454656]">
            Already have an account?{" "}
            <Link href="/login" className="text-[#001BD2] font-bold hover:underline">Sign In</Link>
          </span>
        </div>

        <SignupSteps current={step} />

        {step === 1 ? (
          <div className="flex flex-col gap-6 text-center">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#131B2E] tracking-tight">Start with {planName}</h2>
              <p className="text-base text-[#454656] font-manrope">{copy.blurb}</p>
            </div>

            <div className="rounded-2xl border-2 border-[#001BD2] overflow-hidden text-left">
              <div className="bg-[#001BD2] text-white text-sm font-semibold text-center py-2">Selected Plan</div>
              <div className="p-5 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-full bg-[#EEF0FF] text-[#001BD2] flex items-center justify-center">
                    <copy.Icon className="w-6 h-6" />
                  </span>
                  <span className="text-2xl font-extrabold text-[#131B2E]">{planName}</span>
                </div>
                {selected && (
                  <>
                    <div>
                      <span className="text-4xl font-extrabold text-[#131B2E]">${Number(selected.monthly_price)}</span>
                      <span className="text-[#454656]">/month</span>
                    </div>
                    <ul className="flex flex-col gap-2 font-manrope text-sm text-[#131B2E]">
                      {planBullets(selected).map((b) => (
                        <li key={b} className="flex items-start gap-2">
                          <CheckCircle2 className="w-5 h-5 text-[#001BD2] flex-shrink-0" /> {b}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            {changingPlan ? (
              <div className="grid grid-cols-3 gap-2 font-manrope">
                {plans.map((option) => {
                  const slug = String(option.slug);
                  return (
                    <button key={slug} type="button" onClick={() => { setPlan(slug); setChangingPlan(false); }}
                      className={`rounded-xl border p-2 text-sm font-bold cursor-pointer ${
                        plan === slug ? "border-[#001BD2] bg-[#F2F3FF] text-[#001BD2]" : "border-slate-200 text-[#131B2E]"
                      }`}>
                      {String(option.name)}
                      <span className="block text-xs font-medium text-[#454656]">${Number(option.monthly_price)}/mo</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <button type="button" onClick={() => setChangingPlan(true)}
                className="self-center flex items-center gap-1.5 text-sm font-bold text-[#001BD2] cursor-pointer">
                Change Plan <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button type="button" onClick={() => setStep(2)}
              className="w-full h-14 rounded-xl text-white font-bold text-lg bg-[#001BD2] hover:opacity-95 transition-all">
              Continue with {planName}
            </button>
            <p className="-mt-3 text-xs text-[#757688] font-manrope">
              Plan begins after checkout. You can change your plan at any time during your subscription.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="text-center flex flex-col gap-2">
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#131B2E] tracking-tight">Create Your Brand Account</h2>
              <p className="text-base text-[#454656] font-manrope">
                Create the account your team will use to launch acquisition, loyalty, and review campaigns.
              </p>
            </div>
            <label className={labelClass}>
              Contact Name
              <input type="text" placeholder="Jordan Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputClass} />
            </label>
            <label className={labelClass}>
              Work Email
              <input type="email" placeholder="jordan@yourbrand.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
            </label>
            <label className={labelClass}>
              Phone
              <input type="tel" placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Company / Brand Name
              <input type="text" placeholder="Acme Foods" value={brandName} onChange={(e) => setBrandName(e.target.value)} required className={inputClass} />
            </label>
            <label className={labelClass}>
              Company Website
              <input type="text" placeholder="https://yourbrand.com" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              <span>Business Category <span className="font-medium text-[#94A3B8]">(Optional)</span></span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} text-slate-800`}>
                <option value="">Select a category</option>
                {CATEGORIES.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-3 py-1 font-manrope text-[13px] font-medium text-[#454656] cursor-pointer">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
                className="w-5 h-5 rounded-md border-slate-300 text-[#001BD2] focus:ring-[#001BD2] cursor-pointer" />
              <span>
                I agree to the Nibbl <span className="text-[#001BD2] underline">Terms</span> and{" "}
                <span className="text-[#001BD2] underline">Privacy Policy</span>.
              </span>
            </label>

            {formError && <p className="text-sm font-semibold text-red-600">{formError}</p>}
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

            <button type="submit" disabled={!accepted || status === "loading"}
              className="w-full h-14 rounded-xl text-white font-bold text-lg bg-[#001BD2] hover:opacity-95 transition-all disabled:opacity-60">
              {status === "loading" ? "Sending…" : "Send Magic Link"}
            </button>
            <p className="-mt-2 text-center text-xs text-[#757688] font-manrope">
              We&apos;ll use your work email and company website to confirm this is a brand account.
            </p>
            <button type="button" onClick={() => setStep(1)} className="text-xs font-bold text-[#454656] hover:underline self-center">
              Back to plan
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
