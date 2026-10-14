"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { Header } from "../components/Header";
import { AdminOverview } from "../components/AdminOverview";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useRouter } from "next/navigation";
import { useAdminApiStore } from "@/stores/useAdminApiStore";

export const DashboardView = () => {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState<SidebarNavItem>("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { profile, loadDashboard, logout } = useAdminApiStore();

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleNavSelect = (item: SidebarNavItem) => {
    setActiveNav(item);
    switch (item) {
      case "dashboard":
        router.push("/dashboard");
        break;
      case "earnings":
        router.push("/earnings");
        break;
      case "users":
        router.push("/users");
        break;
      case "brand":
        router.push("/brand");
        break;
      case "promo-codes":
        router.push("/promo-codes");
        break;
      case "campaign-approvals":
        router.push("/campaign-approvals");
        break;
      case "review-flags":
        router.push("/review-flags");
        break;
      case "brand-discovery":
        router.push("/brand-discovery");
        break;
      case "referrals":
        router.push("/referrals");
        break;
      case "refunds":
        router.push("/refunds");
        break;
      case "payout-reviews":
        router.push("/payout-reviews");
        break;
      case "withdraw-request":
        router.push("/withdraw-request");
        break;
      case "settings":
        router.push("/settings");
        break;
      case "logout":
        logout();
        router.push("/");
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#FEFEFE]">
      {/* Responsive Left Sidebar */}
      <Sidebar
        activeNav={activeNav}
        onNavSelect={handleNavSelect}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Dashboard Content Area */}
      <main className="flex-1 w-full min-h-screen p-4 sm:p-6 md:p-8 flex flex-col gap-6 items-stretch bg-[#FEFEFE] overflow-x-hidden">
        {/* Header with Mobile Menu Toggle */}
        <Header
          adminName={String(profile?.full_name || profile?.email || "Admin")}
          adminRole={String(profile?.role || "Admin")}
          unreadCount={0}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          onProfileClick={() => router.push("/settings")}
        />

        {/* Master: revenue summary, needs attention, brand revenue, rewards */}
        <AdminOverview />
      </main>
    </div>
  );
};
