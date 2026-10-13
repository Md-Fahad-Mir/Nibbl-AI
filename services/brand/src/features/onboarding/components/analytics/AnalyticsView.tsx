"use client";

import { CalendarDays } from "lucide-react";
import AnalyticsOverview from "./AnalyticsOverview";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

const RANGES = [7, 30, 90, 365];

/** Master Analytics Overview (one page: Cost & Results, Customer &
 *  Conversion, Campaign Performance). */
export default function AnalyticsView() {
  const days = useBrandApiStore((state) => state.dashboardDays);
  const loadAnalyticsDashboard = useBrandApiStore((state) => state.loadAnalyticsDashboard);
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex flex-col gap-6 w-full animate-slide-up text-left font-manrope">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end w-full gap-4">
        <div className="flex flex-col gap-1 text-left">
          <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight leading-none">
            Analytics Overview
          </h2>
          <p className="text-sm text-[#454656] font-medium mt-1">Understand your costs, results, and where to improve.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <label className="flex items-center gap-2 bg-white border border-[#C5C5D9]/40 rounded-xl px-3 h-10">
            <CalendarDays className="w-4 h-4 text-[#001BD2]" />
            <span className="sr-only">Date range</span>
            <select
              value={days}
              onChange={(e) => void loadAnalyticsDashboard(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-[#131B2E] outline-none cursor-pointer"
            >
              {RANGES.map((d) => (
                <option key={d} value={d}>{d === 365 ? "Last 12 Months" : `Last ${d} Days`}</option>
              ))}
            </select>
          </label>
          <span className="text-xs text-[#64748B]">Data through {today}</span>
        </div>
      </div>

      <AnalyticsOverview />
    </div>
  );
}
