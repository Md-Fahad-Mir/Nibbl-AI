"use client";

import DashboardSnapshots from "./DashboardSnapshots";
import CampaignsTable from "../rebates/CampaignsTable";
import GetStarted from "./GetStarted";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

export default function DashboardView({ onNavigate }: { onNavigate: (tab: string) => void }) {
  // Master: the brand name (from Brand Settings) in the welcome message.
  const brand = useBrandApiStore((state) => state.brand);
  const profile = useBrandApiStore((state) => state.profile);
  const displayName = String(brand?.name ?? profile?.full_name ?? profile?.email ?? "there");

  return (
    <div className="flex flex-col gap-12 w-full">
      {/* Welcome Message */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold font-jakarta text-[#131B2E]">
          Welcome back, {displayName}
        </h1>
        <p className="text-sm font-manrope text-[#454656] font-medium">
          Here&apos;s what&apos;s happening with your campaigns today.
        </p>
      </div>

      <GetStarted onNavigate={onNavigate} />

      {/* SNAPSHOTS (last 30 days) */}
      <DashboardSnapshots />
      <CampaignsTable />
    </div>
  );
}
