"use client";

import React, { useMemo, useRef, useState } from "react";
import { MonthlyEarning } from "@/types/dashboard.types";

interface EarningsChartProps {
  data?: MonthlyEarning[];
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fallbackYear = "2026";

const formatAxisMoney = (value: number) => {
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  return `$${Math.round(value)}`;
};

export const EarningsChart: React.FC<EarningsChartProps> = ({ data = [] }) => {
  const [selectedYear, setSelectedYear] = useState(fallbackYear);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableYears = useMemo(() => {
    const years = Array.from(
      new Set(data.map((item) => item.year).filter(Boolean) as string[])
    ).sort((a, b) => Number(b) - Number(a));
    return years.length ? years : [fallbackYear];
  }, [data]);

  const activeYear = availableYears.includes(selectedYear)
    ? selectedYear
    : availableYears[0];

  const currentChartData = useMemo(
    () =>
      months.map((month) => {
        const item = data.find(
          (entry) => entry.year === activeYear && entry.month === month
        );
        return item || { year: activeYear, month, amount: 0, formattedAmount: "$0.00" };
      }),
    [activeYear, data]
  );

  const maxAmount = Math.max(...currentChartData.map((item) => item.amount), 0);
  const chartMax = maxAmount > 0 ? Math.ceil(maxAmount / 100) * 100 : 1;
  const hasData = maxAmount > 0;
  const yLabels = Array.from({ length: 6 }, (_, index) =>
    formatAxisMoney(chartMax - (chartMax / 5) * index)
  );

  return (
    <div className="w-full h-auto min-h-[300px] bg-[#FEFEFE] rounded-[8px] shadow-[0px_2px_8px_rgba(0,0,0,0.1)] p-4 sm:p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between w-full mb-4">
        <h2 className="font-inter text-[18px] sm:text-[20px] font-medium leading-[24px] text-[#1F1D1D]">
          Earnings
        </h2>

        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen((open) => !open)}
            className="flex items-center gap-2 font-inter text-[16px] sm:text-[18px] font-medium text-[#1F1D1D] hover:opacity-80 transition-opacity cursor-pointer focus:outline-none"
            aria-label="Select year"
            aria-expanded={isDropdownOpen}
          >
            <span>{activeYear}</span>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1F1D1D"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-30 font-inter text-[16px]">
              {availableYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => {
                    setSelectedYear(year);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-[#3E3EDF]/10 transition-colors cursor-pointer ${
                    activeYear === year
                      ? "text-[#3E3EDF] font-semibold bg-[#3E3EDF]/5"
                      : "text-[#575757]"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-2">
        <div className="min-w-[500px] sm:min-w-full flex items-end gap-3 h-[200px] relative pt-6">
          <div className="h-full flex flex-col justify-between pr-2 text-right font-inter text-[12px] sm:text-[14px] font-medium text-[#575757] shrink-0 pb-6">
            {yLabels.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>

          <div className="flex-1 h-full flex flex-col justify-between relative">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
              {yLabels.map((label, index) => (
                <div key={`${label}-${index}`} className="w-full border-t border-[#575757]/20 h-0" />
              ))}
            </div>

            {!hasData && (
              <div className="absolute inset-x-0 top-12 z-20 text-center font-inter text-[14px] text-[#777777]">
                No earnings returned from the backend for this year.
              </div>
            )}

            <div className="w-full h-[155px] flex items-end justify-between px-2 relative z-10">
              {currentChartData.map((item) => {
                const heightPercent = hasData
                  ? Math.min(100, (item.amount / chartMax) * 100)
                  : 0;
                const isHighlighted = hoveredMonth === item.month;

                return (
                  <div
                    key={item.month}
                    onMouseEnter={() => setHoveredMonth(item.month)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    className="flex flex-col items-center group relative h-full justify-end cursor-pointer"
                  >
                    {isHighlighted && (
                      <div className="absolute -top-7 bg-white text-[#575757] font-inter text-[12px] px-2 py-0.5 rounded shadow-[0px_0px_18px_rgba(0,0,0,0.1)] whitespace-nowrap z-20">
                        {item.formattedAmount}
                      </div>
                    )}

                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-4 sm:w-6 bg-[#3E3EDF] rounded-t-[2.5px] transition-all duration-300 group-hover:bg-[#3232C7]"
                    />
                  </div>
                );
              })}
            </div>

            <div className="w-full flex items-center justify-between px-2 pt-2 border-t border-[#575757] text-center font-inter text-[12px] sm:text-[14px] text-[#575757]">
              {currentChartData.map((item) => (
                <span key={item.month} className="w-4 sm:w-6 text-center">
                  {item.month}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
