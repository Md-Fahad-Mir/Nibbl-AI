"use client";

export default function BudgetTipBanner() {
  return (
    <div className="w-full bg-[#F2F3FF] rounded-xl p-6 flex flex-row items-start gap-4 text-left font-manrope">
      {/* Icon Card */}
      <div className="w-10 h-10 bg-white shadow-sm rounded-lg flex items-center justify-center text-lg flex-shrink-0">
        💡
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold text-[#131B2E]">Pro Tip: Scaling Performance</span>
        <p className="text-sm text-[#454656] leading-[23px] font-medium">
          Most Q4 growth strategies see a 20% higher conversion rate when the daily budget is set above $50.00. Consider increasing your cap to maximize high-intent customer traffic.
        </p>
      </div>
    </div>
  );
}
