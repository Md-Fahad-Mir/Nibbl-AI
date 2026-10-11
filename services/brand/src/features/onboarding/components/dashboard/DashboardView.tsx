"use client";

import DashboardSnapshots from "./DashboardSnapshots";
import CampaignsTable from "../rebates/CampaignsTable";
import GetStarted from "./GetStarted";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

// Master: date range defaults to Last 30 Days for the snapshots and the
// campaign table (Available Funds stays current).
const RANGES = [7, 30, 90, 365];

export default function DashboardView({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const days = useBrandApiStore((state) => state.dashboardDays);
  const loadAnalyticsDashboard = useBrandApiStore((state) => state.loadAnalyticsDashboard);
  // Master: the brand name (from Brand Settings) in the welcome message.
  const brand = useBrandApiStore((state) => state.brand);
  const profile = useBrandApiStore((state) => state.profile);
  const displayName = String(brand?.name ?? profile?.full_name ?? profile?.email ?? "there");

  return (
    <div className="flex flex-col gap-12 w-full">
      {/* Welcome Message */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold font-jakarta text-[#131B2E]">
            Welcome back, {displayName}
          </h1>
          <p className="text-sm font-manrope text-[#454656] font-medium">
            Here&apos;s what&apos;s happening with your campaigns today.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-[#454656] font-manrope">
          Date range
          <select value={days} onChange={(e) => void loadAnalyticsDashboard(Number(e.target.value))}
            className="h-10 px-3 bg-white border border-[#C5C5D9]/30 rounded-xl text-xs font-bold text-[#131B2E] outline-none cursor-pointer">
            {RANGES.map((d) => <option key={d} value={d}>{d === 365 ? "Last 12 Months" : `Last ${d} Days`}</option>)}
          </select>
        </label>
      </div>

      <GetStarted onNavigate={onNavigate} />

      {/* SNAPSHOTS (selected date range) */}
      <DashboardSnapshots />
      <CampaignsTable />
    </div>
  );
}
