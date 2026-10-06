"use client";

import RebateSnapshot from "../rebates/RebateSnapshot";
import ReviewSnapshot from "../reviews/ReviewSnapshot";
import CampaignsTable from "../rebates/CampaignsTable";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

export default function DashboardView() {
  const profile = useBrandApiStore((state) => state.profile);
  const displayName = String(profile?.full_name ?? profile?.email ?? "there");

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

      {/* SNAPSHOTS */}
      <RebateSnapshot />
      <ReviewSnapshot />
      <CampaignsTable />
    </div>
  );
}
