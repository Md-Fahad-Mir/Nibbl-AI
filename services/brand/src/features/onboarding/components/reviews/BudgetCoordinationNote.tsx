"use client";

export default function BudgetCoordinationNote() {
  return (
    <div className="flex flex-row items-start p-4 gap-3 w-full bg-[#001BD2]/5 border border-[#001BD2]/10 rounded-[18px] text-left font-manrope">
      <div className="flex items-center justify-center w-7 h-7 bg-[#001BD2]/10 rounded-[12px] flex-shrink-0">
        <span className="text-[#001BD2] font-bold text-sm">ℹ️</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-[#131B2E] tracking-normal">Budget Coordination Note</span>
        <p className="text-[11px] text-[#454656] leading-[15px] font-medium">
          All reviews in this campaign will share the same global budget defined in the next step. Product selections here help us estimate your reach across different categories.
        </p>
      </div>
    </div>
  );
}
