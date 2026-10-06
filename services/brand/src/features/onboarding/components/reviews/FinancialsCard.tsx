"use client";

interface FinancialsCardProps {
  dailyBudget: number;
}

export default function FinancialsCard({ dailyBudget }: FinancialsCardProps) {
  const reviewsPerDay = Math.round(dailyBudget / 2.5) || 0;
  const totalCommitment = dailyBudget * 30; // 30 day estimate standard

  return (
    <div className="w-full lg:w-[359.33px] min-h-[393px] bg-[#001BD2] rounded-xl p-8 flex flex-col justify-between text-left font-manrope relative overflow-hidden flex-shrink-0 text-white">
      {/* Background Glow Overlay */}
      <div className="absolute w-48 h-48 bg-[#2D3FEA] opacity-20 blur-[32px] rounded-full -right-12 -top-12 pointer-events-none z-0"></div>

      <div className="flex flex-col gap-6 z-10">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white/20 rounded-full flex items-center justify-center text-white text-[10px]">💼</div>
          <h3 className="font-jakarta font-bold text-base text-white">Financials</h3>
        </div>

        {/* Daily Review Budget */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-white/60 tracking-[1.2px] uppercase">
            DAILY REVIEW BUDGET
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-white">${dailyBudget.toFixed(2)}</span>
            <span className="text-sm font-medium text-white/70">/ day</span>
          </div>
        </div>

        {/* Estimated Reviews */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-white/60 tracking-[1.2px] uppercase">
            ESTIMATED REVIEWS
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-white">{reviewsPerDay}</span>
            <span className="text-sm font-medium text-white/70">/ day</span>
          </div>
        </div>
      </div>

      {/* Footer Total Commitment */}
      <div className="pt-6 border-t border-white/10 flex flex-col gap-1 z-10 mt-6">
        <span className="text-xs font-semibold text-white/60 tracking-[1.2px] uppercase">
          TOTAL COMMITMENT (30 DAYS)
        </span>
        <span className="text-2xl font-bold text-white">
          ${totalCommitment.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

    </div>
  );
}
