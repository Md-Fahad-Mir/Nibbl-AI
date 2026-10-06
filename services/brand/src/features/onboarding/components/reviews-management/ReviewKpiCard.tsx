/* eslint-disable @next/next/no-img-element */
"use client";

interface ReviewKpiCardProps {
  title: string;
  value: string;
  badgeText: string;
  badgeType: "green" | "gray";
  iconPath: string;
  iconBgColor: string;
}

export default function ReviewKpiCard({
  title,
  value,
  badgeText,
  badgeType,
  iconPath,
  iconBgColor,
}: ReviewKpiCardProps) {
  return (
    <div className="bg-white border border-[#C5C5D9]/10 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-[24px] p-8 flex flex-col justify-between font-manrope text-left w-full h-[224px] relative">
      {/* Top Row: Icon & Badge */}
      <div className="flex justify-between items-start w-full">
        {/* Icon Overlay */}
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${iconBgColor}`}>
          <img src={iconPath} alt={title} className="w-5 h-5 object-contain" />
        </div>

        {/* Badge */}
        {badgeType === "green" ? (
          <span className="bg-[#F0FDF4] text-[#16A34A] text-xs font-bold px-3 py-1 rounded-lg">
            {badgeText}
          </span>
        ) : (
          <span className="text-xs font-bold text-[#454656]/60 tracking-wider uppercase pt-1">
            {badgeText}
          </span>
        )}
      </div>

      {/* Bottom Row: Text content */}
      <div className="flex flex-col gap-1 mt-4">
        <span className="text-base font-medium text-[#454656]">{title}</span>
        <span className="text-[36px] font-bold text-[#131B2E] leading-none mt-1">
          {value}
        </span>
      </div>
    </div>
  );
}
