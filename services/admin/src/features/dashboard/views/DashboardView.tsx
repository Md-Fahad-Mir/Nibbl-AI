"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { Header } from "../components/Header";
import { StatsCards } from "../components/StatsCards";
import { EarningsChart } from "../components/EarningsChart";
import { RecentTransactions } from "../components/RecentTransactions";
import { TransactionDetailsModal } from "@/features/earnings/components/TransactionDetailsModal";
import { TransactionDetail } from "@/types/earnings.types";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useRouter } from "next/navigation";
import { useAdminApiStore } from "@/stores/useAdminApiStore";

export const DashboardView = () => {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState<SidebarNavItem>("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionDetail | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const { profile, stats, transactions, monthlyEarnings, loadDashboard, logout } = useAdminApiStore();

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

  const handleViewTransaction = (transaction: TransactionDetail) => {
    setSelectedTransaction(transaction);
    setIsTransactionModalOpen(true);
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

        {/* Stats Summary Cards */}
        <StatsCards stats={stats} />

        {/* Earnings Bar Chart */}
        <EarningsChart data={monthlyEarnings} />

        {/* Recent Transactions Table */}
        <RecentTransactions
          transactions={transactions}
          onViewTransaction={handleViewTransaction}
        />
      </main>

      <TransactionDetailsModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        transaction={selectedTransaction}
      />
    </div>
  );
};
