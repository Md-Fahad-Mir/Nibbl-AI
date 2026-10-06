"use client";

interface PerformanceEstimatorCardProps {
  dailyBudget: number;
}

export default function PerformanceEstimatorCard({ dailyBudget }: PerformanceEstimatorCardProps) {
  const estimatedReviewsPerDay = Math.round(dailyBudget / 2.5) || 0;
  const weeklyReach = estimatedReviewsPerDay * 7;
  const roiImpact = estimatedReviewsPerDay > 0 
    ? `+${(1.2 * estimatedReviewsPerDay + 0.4).toFixed(1)}%` 
    : "0.0%";

  return (
    <div className="w-full lg:w-[359.33px] bg-white border border-[#C5C5D9]/10 shadow-[0px_24px_48px_rgba(19,27,46,0.06)] rounded-xl p-8 flex flex-col gap-6 font-manrope text-left flex-shrink-0">
      
      {/* Title */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-[#001BD2] rounded-sm flex items-center justify-center text-white text-[10px]">📈</div>
        <h4 className="text-sm font-bold text-[#131B2E]">Performance Estimator</h4>
      </div>

      {/* Main Stats Block */}
      <div className="bg-[#F2F3FF] rounded-xl py-6 px-4 flex flex-col items-center gap-2">
        <span className="text-[10px] font-bold text-[#454656] tracking-[1.2px] uppercase">
          ESTIMATED REVIEWS PER DAY
        </span>
        <span className="text-[60px] font-extrabold text-[#001BD2] leading-none">
          {estimatedReviewsPerDay}
        </span>
        <span className="text-[12px] font-medium text-[#454656] mt-1 text-center">
          Based on your ${dailyBudget.toFixed(2)} daily budget
        </span>
      </div>

      {/* Progress Bars & Reach Stats */}
      <div className="flex flex-col gap-4">
        {/* Weekly Reach */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-xs font-semibold text-[#454656]">
            <span>Weekly Reach</span>
            <span className="text-[#131B2E] font-bold">~{weeklyReach} Reviews</span>
          </div>
          <div className="w-full bg-[#EAEDFF] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#4CD7F6] h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(estimatedReviewsPerDay * 8, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* ROI Impact */}
        <div className="flex justify-between items-center text-xs font-semibold text-[#454656]">
          <span>Est. ROI Impact</span>
          <span className="text-[#004956] font-bold text-sm">{roiImpact}</span>
        </div>
      </div>

    </div>
  );
}
