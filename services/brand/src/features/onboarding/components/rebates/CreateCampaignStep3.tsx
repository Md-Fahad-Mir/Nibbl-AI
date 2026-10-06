/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Pencil, Rocket } from "lucide-react";

interface RewardTier {
  id: string;
  name: string;
  structure: string;
  reward: string;
  maxPayout: string;
  minPurchase: string;
  allocation: number;
}

interface BudgetOfferDraft {
  dailyBudget: number;
  fallback: {
    rewardAmount: string;
    isEnabled: boolean;
    description: string;
  };
}

interface Step3Props {
  onBack: () => void;
  onContinue: (draft: BudgetOfferDraft) => void;
  tiers: RewardTier[];
  initialData?: {
    dailyBudget?: number;
    fallback?: {
      rewardAmount: string;
      isEnabled: boolean;
      description?: string;
    };
  };
  onAddCustomTierClick: () => void;
  onEditTierClick: (tier: RewardTier) => void;
}
export default function CreateCampaignStep3({
  onBack,
  onContinue,
  tiers,
  initialData,
  onAddCustomTierClick,
  onEditTierClick,
}: Step3Props) {
  const [budget, setBudget] = useState(String(initialData?.dailyBudget ?? 150));
  const [fallbackActive, setFallbackActive] = useState(initialData?.fallback?.isEnabled ?? true);
  const [fallbackReward, setFallbackReward] = useState(initialData?.fallback?.rewardAmount ?? "2.00");
  const [fallbackDescription, setFallbackDescription] = useState(
    initialData?.fallback?.description || "Fallback offer for receipts that do not meet a tier."
  );
  const showWarning = Number(budget) > 100;
  const daysRemaining = showWarning && Number(budget) > 0 ? Math.floor(2450 / Number(budget)) : 0;
  const totalAlloc = tiers.reduce((acc, t) => acc + t.allocation, 0);
  const handleContinue = () => {
    onContinue({
      dailyBudget: Number(budget) > 0 ? Number(budget) : 1,
      fallback: {
        rewardAmount: Number(fallbackReward) > 0 ? Number(fallbackReward).toFixed(2) : "1.00",
        isEnabled: fallbackActive,
        description: fallbackDescription,
      },
    });
  };

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left font-manrope">
      {/* Stepper indications */}
      <div className="relative grid grid-cols-4 items-start gap-2 w-full max-w-[920px] mx-auto font-semibold border-b border-slate-100 py-3">
        <div className="absolute left-[12.5%] right-[12.5%] top-[31px] h-[2px] bg-[#EAEDFF]"></div>
        <div className="absolute left-[12.5%] w-[50%] top-[31px] h-[2px] bg-[#001BD2]"></div>
        {[
          { step: "1", title: "Basic Info", done: true },
          { step: "2", title: "Products", done: true },
          { step: "3", title: "Budget & Offers", active: true },
          { step: "4", title: "Review & publish", active: false },
        ].map((s) => (
          <div key={s.step} className="relative z-10 flex flex-col items-center gap-2 min-w-0">
            <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${s.active ? "bg-[#001BD2] text-white shadow-[0_0_0_8px_#DFE0FF]" : "bg-[#DAE2FD] text-[#001BD2]"}`}>{s.done && !s.active ? "✓" : s.step}</span>
            <span className={s.active ? "text-[#001BD2] text-xs text-center" : "text-slate-400 text-xs text-center"}>{s.title}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-end w-full">
        <div>
          <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">Step 03</h2>
          <h3 className="text-xl font-bold text-[#454656] mt-1">Budget & Offers Configuration</h3>
        </div>
        <span className="text-xs font-bold text-slate-400">65% Complete</span>
      </div>
      <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
        {/* Left Column */}
        <div className="flex flex-col gap-6 w-full lg:max-w-[36%]">
          <div className="bg-white border border-slate-100 rounded-[20px] p-6 shadow-sm flex flex-col gap-6 w-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <img src="/Rebate/availableWalletIcon.svg" alt="Wallet" className="w-3.5 h-3 object-contain" />Available Wallet
              </span>
              <div className="flex items-center gap-1 text-sm font-extrabold text-[#131B2E]">$2,450.00</div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#454656] uppercase tracking-wider">Daily Campaign Budget</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#454656]">$</span>
                <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full h-11 bg-[#F2F3FF] border border-transparent rounded-xl pl-8 pr-4 text-sm font-extrabold text-[#131B2E] focus:outline-none focus:border-[#001BD2]" />
              </div>
            </div>
            {showWarning && (
              <div className="bg-[#FEF2F2] border border-[#FEF2F2] rounded-xl p-4 flex gap-3 text-left">
                <img src="/Rebate/warningIcon.svg" alt="Warning" className="w-5 h-5 object-contain flex-shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold text-[#BA1A1A]">LOW BALANCE WARNING</span>
                  <p className="text-[9px] text-[#BA1A1A]/85 font-medium mt-1 leading-normal">
                    Based on your daily budget, your wallet will be depleted in {daysRemaining} days. Set up auto-refill to prevent campaign pauses.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="bg-white border border-slate-100 rounded-[20px] p-6 shadow-sm flex flex-col gap-6 w-full">
            <div className="flex justify-between items-center border-b border-slate-50 pb-4">
              <div className="flex flex-col text-left">
                <h4 className="text-[10px] font-extrabold text-[#131B2E] tracking-wider uppercase flex items-center gap-1.5">
                  <img src="/Rebate/fallbackIcon.svg" alt="Fallback" className="w-3.5 h-3.5 object-contain" />Fallback Configuration
                </h4>
                <p className="text-[9px] text-[#64748B] font-medium mt-0.5">Applied when tier criteria aren&apos;t met.</p>
              </div>
              <button type="button" onClick={() => setFallbackActive(!fallbackActive)} className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-150 cursor-pointer ${fallbackActive ? "bg-[#001BD2]" : "bg-slate-200"}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-150 ${fallbackActive ? "translate-x-5" : "translate-x-0"}`}></div>
              </button>
            </div>
            {fallbackActive && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[#454656] uppercase tracking-wider">REWARD</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={fallbackReward}
                    onChange={(e) => setFallbackReward(e.target.value)}
                    className="w-full h-10 bg-[#FAF8FF] border border-[#C5C5D9]/25 rounded-xl px-4 text-xs font-bold text-[#131B2E]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[#454656] uppercase tracking-wider">DESCRIPTION</label>
                  <input
                    type="text"
                    value={fallbackDescription}
                    onChange={(e) => setFallbackDescription(e.target.value)}
                    className="w-full h-10 bg-[#FAF8FF] border border-[#C5C5D9]/25 rounded-xl px-4 text-xs font-bold text-[#131B2E]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Right Column */}
        <div className="flex-grow flex flex-col gap-6 w-full lg:max-w-[64%]">
          <div className="bg-white border border-slate-100 rounded-[20px] p-6 shadow-sm flex flex-col gap-6 w-full">
            <div className="flex justify-between items-center w-full">
              <div>
                <h3 className="text-xs font-extrabold text-[#131B2E] tracking-wider uppercase">REWARD TIERS BUILDER</h3>
                <p className="text-[9px] text-[#64748B] font-medium mt-0.5">Max payout limits how much you pay for a reward.</p>
              </div>
              <button onClick={onAddCustomTierClick} className="text-xs font-extrabold text-[#001BD2] hover:underline cursor-pointer">+ Add Custom Tier</button>
            </div>
            <div className="w-full overflow-hidden border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 h-10 text-[#454656] font-bold border-b border-slate-100">
                    <th className="px-4">TIER IDENTITY</th>
                    <th className="px-2">STRUCTURE</th>
                    <th className="px-2">REWARD</th>
                    <th className="px-2">MAX PAYOUT</th>
                    <th className="px-2">MIN PURCHASE</th>
                    <th className="px-4 text-right">ALLOC.</th>
                    <th className="px-4 text-right">EDIT</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier) => (
                    <tr key={tier.id} className="h-12 border-b border-slate-50 hover:bg-slate-50/50 transition-colors font-semibold text-[#131B2E]">
                      <td className="px-4 text-[#001BD2]">{tier.name}</td>
                      <td className="px-2">{tier.structure}</td>
                      <td className="px-2">{tier.reward}</td>
                      <td className="px-2">${tier.maxPayout}</td>
                      <td className="px-2">{tier.minPurchase}</td>
                      <td className="px-4 text-right text-[#001BD2]">{tier.allocation}%</td>
                      <td className="px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onEditTierClick(tier)}
                          className="ml-auto w-8 h-8 rounded-full bg-[#001BD2] hover:bg-blue-700 transition-colors flex items-center justify-center shadow-sm active:scale-95 cursor-pointer"
                          aria-label={`Edit ${tier.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5 text-white" strokeWidth={2.4} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Smart Meter */}
            <div className="flex flex-col gap-3 border-t border-slate-100 pt-6">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-extrabold text-[#131B2E] tracking-wider uppercase">SMART ALLOCATION METER</h4>
                <span className="bg-emerald-50 text-[#059669] text-[9px] font-bold px-2 py-0.5 rounded">{totalAlloc === 100 ? "Total 100% Balanced" : `${totalAlloc}% Allocated`}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full flex overflow-hidden">
                {tiers.map((t, idx) => {
                  const colors = ["bg-[#001BD2]", "bg-blue-500", "bg-sky-400", "bg-indigo-300"];
                  return <div key={t.id} className={colors[idx % colors.length]} style={{ width: `${t.allocation}%` }}></div>;
                })}
              </div>
              <div className="flex flex-wrap gap-4 text-[10px] font-bold text-[#454656] mt-1">
                {tiers.map((t, idx) => {
                  const dotColors = ["bg-[#001BD2]", "bg-blue-500", "bg-sky-400", "bg-indigo-300"];
                  return (
                    <div key={t.id} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${dotColors[idx % dotColors.length]}`}></span>
                      <span>{t.name.split(" ").slice(1).join(" ") || t.name} ({t.allocation}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Footer */}
      <div className="flex justify-between items-center w-full border-t border-slate-100 pt-6 mt-4">
        <button onClick={onBack} className="text-sm font-bold text-[#757688] hover:text-slate-600 cursor-pointer">← Back to Products</button>
        <button onClick={handleContinue} className="px-6 h-[46px] bg-[#001BD2] hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center gap-2">
          <span>Continue to Review</span>
          <Rocket className="w-4 h-4 text-white" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
