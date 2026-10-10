"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/features/dashboard/components/Sidebar";
import { Header } from "@/features/dashboard/components/Header";
import { StatsCards } from "@/features/dashboard/components/StatsCards";
import { WithdrawRequestTable } from "../components/WithdrawRequestTable";
import { WithdrawDetailsModal } from "../components/WithdrawDetailsModal";
import { WithdrawRequestDetail } from "@/types/withdraw-request.types";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useRouter } from "next/navigation";
import { useAdminApiStore } from "@/stores/useAdminApiStore";

export const WithdrawRequestView = () => {
  const router = useRouter();
  const [selectedRequest, setSelectedRequest] =
    useState<WithdrawRequestDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const {
    profile,
    stats,
    withdrawals,
    loadDashboard,
    loadWithdrawals,
    processWithdrawal,
    logout,
  } = useAdminApiStore();

  useEffect(() => {
    void loadDashboard();
    void loadWithdrawals();
  }, [loadDashboard, loadWithdrawals]);

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
      case "review-flags":
        router.push("/review-flags");
        break;
      case "brand-discovery":
        router.push("/brand-discovery");
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

  const handleOpenModal = (request: WithdrawRequestDetail) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
  };

  const handleApprove = () => {
    if (selectedRequest?.id) void processWithdrawal(selectedRequest.id, "approve");
    setIsModalOpen(false);
  };

  const handleCancelRequest = () => {
    if (selectedRequest?.id) void processWithdrawal(selectedRequest.id, "reject");
    setIsModalOpen(false);
  };

  return (
    <div className="flex min-h-screen w-full bg-[#FEFEFE]">
      {/* Responsive Sidebar */}
      <Sidebar
        activeNav="withdraw-request"
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

        {/* Withdrawal analytics use the shared admin overview cards until a dedicated withdrawal overview endpoint exists. */}
        <StatsCards stats={stats} />

        {/* Withdraw Request Table */}
        <WithdrawRequestTable
          requests={withdrawals}
          onViewRequest={handleOpenModal}
        />
      </main>

      {/* Withdraw Details Modal */}
      <WithdrawDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        request={selectedRequest}
        onApprove={handleApprove}
        onCancelRequest={handleCancelRequest}
      />
    </div>
  );
};
