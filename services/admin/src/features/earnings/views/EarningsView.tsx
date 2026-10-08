"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/features/dashboard/components/Sidebar";
import { Header } from "@/features/dashboard/components/Header";
import { StatsCards } from "@/features/dashboard/components/StatsCards";
import { EarningsTable } from "../components/EarningsTable";
import { TransactionDetailsModal } from "../components/TransactionDetailsModal";
import { TransactionDetail } from "@/types/earnings.types";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useRouter } from "next/navigation";
import { useAdminApiStore } from "@/stores/useAdminApiStore";

export const EarningsView = () => {
  const router = useRouter();
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { profile, stats, transactions, loadDashboard, logout } = useAdminApiStore();

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleNavSelect = (item: SidebarNavItem) => {
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

  const handleOpenModal = (transaction: TransactionDetail) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  return (
    <div className="flex min-h-screen w-full bg-[#FEFEFE]">
      {/* Responsive Sidebar */}
      <Sidebar
        activeNav="earnings"
        onNavSelect={handleNavSelect}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full min-h-screen p-4 sm:p-6 md:p-8 flex flex-col gap-6 items-stretch bg-[#FEFEFE] overflow-x-hidden">
        {/* Header */}
        <Header
          adminName={String(profile?.full_name || profile?.email || "Admin")}
          adminRole={String(profile?.role || "Admin")}
          unreadCount={0}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          onProfileClick={() => router.push("/settings")}
        />

        {/* Stats Cards */}
        <StatsCards stats={stats} />

        {/* Earnings Table with Filter & Pagination */}
        <EarningsTable
          transactions={transactions}
          onViewTransaction={handleOpenModal}
        />
      </main>

      {/* Transaction Details Modal */}
      <TransactionDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={selectedTransaction}
      />
    </div>
  );
};
