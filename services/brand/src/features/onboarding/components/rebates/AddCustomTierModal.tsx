import { useState } from "react";

interface AddCustomTierModalProps {
  onClose: () => void;
  onAdd: (tier: {
    name: string;
    structure: string;
    reward: string;
    maxPayout: string;
    minPurchase: string;
    allocation: number;
  }) => void;
  initialTier?: {
    name: string;
    structure: string;
    reward: string;
    maxPayout: string;
    minPurchase: string;
    allocation: number;
  };
  mode?: "add" | "edit";
}

const readRewardValue = (reward: string) => {
  const match = reward.match(/[\d.]+/);
  return match?.[0] ?? reward;
};

export default function AddCustomTierModal({
  onClose,
  onAdd,
  initialTier,
  mode = "add",
}: AddCustomTierModalProps) {
  const [tierName, setTierName] = useState(
    initialTier?.name.replace(/^\d+\s+/, "") ?? ""
  );
  const [structure, setStructure] = useState(initialTier?.structure ?? "Dollar Off");
  const [rewardValue, setRewardValue] = useState(
    initialTier ? readRewardValue(initialTier.reward) : ""
  );
  const [maxPayout, setMaxPayout] = useState(initialTier?.maxPayout ?? "");
  const [minPurchase, setMinPurchase] = useState(initialTier?.minPurchase ?? "");
  const [allocation, setAllocation] = useState(initialTier?.allocation ?? 25);

  const handleAdd = () => {
    if (!tierName) return;
    onAdd({
      name: mode === "edit" && initialTier ? `${initialTier.name.match(/^\d+/)?.[0] ?? ""} ${tierName}`.trim() : `05 ${tierName}`,
      structure,
      reward: structure === "Percent Off" ? `${rewardValue}% off` : structure === "Dollar Off" ? `$${rewardValue} off` : rewardValue || "Free",
      maxPayout: maxPayout || "0",
      minPurchase: minPurchase || "0",
      allocation,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-jakarta">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-[540px] flex flex-col overflow-hidden animate-scale-in border border-slate-100/50">
        
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-5 border-b border-slate-100">
          <h2 className="text-xl font-bold text-[#131B2E] tracking-tight">
            {mode === "edit" ? "Edit Tier" : "Add Custom Tier"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors text-lg cursor-pointer">✕</button>
        </div>

        {/* Form Body */}
        <div className="p-8 flex flex-col gap-6 text-left font-manrope">
          {/* Step 1: Tier Identity */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-[#001BD2] tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#E2E7FF] text-[#001BD2] text-[10px] font-extrabold flex items-center justify-center">1</span>
              TIER IDENTITY
            </span>
            <div className="flex flex-col gap-1.5 pl-7">
              <label className="text-[10px] font-bold text-[#454656] uppercase tracking-wider">TIER NAME</label>
              <input
                type="text"
                value={tierName}
                onChange={(e) => setTierName(e.target.value)}
                placeholder="e.g., VIP Early Bird"
                className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-xs font-semibold focus:outline-none focus:border-[#001BD2] text-slate-800 placeholder-[#757688]"
              />
            </div>
          </div>

          {/* Step 2: Reward Logic */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-[#001BD2] tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#E2E7FF] text-[#001BD2] text-[10px] font-extrabold flex items-center justify-center">2</span>
              REWARD LOGIC
            </span>
            <div className="grid grid-cols-2 gap-4 pl-7">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#454656] uppercase tracking-wider">REWARD STRUCTURE</label>
                <select
                  value={structure}
                  onChange={(e) => setStructure(e.target.value)}
                  className="w-full h-11 bg-[#FAF8FF] border border-[#C5C5D9]/20 rounded-xl px-4 text-xs font-bold text-[#131B2E] focus:outline-none focus:border-[#001BD2]"
                >
                  <option>Dollar Off</option>
                  <option>Percent Off</option>
                  <option>Free up to X</option>
                  <option>BOGO</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#454656] uppercase tracking-wider">REWARD VALUE</label>
                <input
                  type="text"
                  value={rewardValue}
                  onChange={(e) => setRewardValue(e.target.value)}
                  placeholder="e.g., 10"
                  className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-xs font-semibold focus:outline-none focus:border-[#001BD2] text-slate-800 placeholder-[#757688]"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Financial Guardrails */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-[#001BD2] tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#E2E7FF] text-[#001BD2] text-[10px] font-extrabold flex items-center justify-center">3</span>
              FINANCIAL GUARDRAILS
            </span>
            <div className="grid grid-cols-2 gap-4 pl-7">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#454656] uppercase tracking-wider">MAX PAYOUT</label>
                <input
                  type="text"
                  value={maxPayout}
                  onChange={(e) => setMaxPayout(e.target.value)}
                  placeholder="$50.00"
                  className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-xs font-semibold focus:outline-none focus:border-[#001BD2] text-slate-800 placeholder-[#757688]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#454656] uppercase tracking-wider">MINIMUM PURCHASE</label>
                <input
                  type="text"
                  value={minPurchase}
                  onChange={(e) => setMinPurchase(e.target.value)}
                  placeholder="Optional"
                  className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-xs font-semibold focus:outline-none focus:border-[#001BD2] text-slate-800 placeholder-[#757688]"
                />
              </div>
            </div>
          </div>

          {/* Step 4: Allocation Slider */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center pl-7">
              <span className="text-[10px] font-bold text-[#454656] uppercase tracking-wider">BUDGET ALLOCATION</span>
              <span className="text-xs font-extrabold text-[#001BD2] bg-[#E2E7FF]/40 px-2 py-0.5 rounded">{allocation}%</span>
            </div>
            <div className="pl-7 pr-4 mt-2">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={allocation}
                onChange={(e) => setAllocation(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#001BD2]"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-4 px-8 py-5 bg-slate-50/50 border-t border-slate-100">
          <button onClick={onClose} className="text-sm font-bold text-[#757688] hover:text-slate-600 cursor-pointer">Cancel</button>
          <button
            onClick={handleAdd}
            disabled={!tierName}
            className={`px-6 h-[46px] bg-[#001BD2] hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/10 ${!tierName ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {mode === "edit" ? "Save Tier" : "Add Tier"}
          </button>
        </div>

      </div>
    </div>
  );
}
