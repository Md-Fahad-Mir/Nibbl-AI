"use client";

import Link from "next/link";
import { SidebarNavItem } from "@/types/dashboard.types";

// Master sidebar has nine items; these related pages sit as tabs under them.
const GROUPS: { id: SidebarNavItem; label: string }[][] = [
  [{ id: "withdraw-request", label: "Withdrawals" }, { id: "payout-reviews", label: "Payout Method Reviews" }],
  [{ id: "brand", label: "Brands" }, { id: "brand-discovery", label: "Brand Discovery" }, { id: "refunds", label: "Refund Requests" }],
  [{ id: "campaign-approvals", label: "Campaign Approvals" }, { id: "review-flags", label: "Flagged Reviews" }],
  [{ id: "users", label: "Shoppers" }, { id: "suspensions", label: "Suspensions" }],
];

export const SectionTabs = ({ current }: { current: SidebarNavItem }) => {
  const group = GROUPS.find((g) => g.some((t) => t.id === current));
  if (!group) return null;
  return (
    <nav className="flex flex-wrap gap-1 border-b border-[#ECECF5]">
      {group.map((t) => (
        <Link key={t.id} href={`/${t.id}`}
          className={`px-4 py-2 text-sm font-semibold -mb-px border-b-2 ${
            t.id === current ? "border-[#3E3EDF] text-[#3E3EDF]" : "border-transparent text-[#6B6B80] hover:text-[#1A1A2E]"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
};
