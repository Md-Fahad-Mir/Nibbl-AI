"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/features/dashboard/components/Sidebar";
import { Header } from "@/features/dashboard/components/Header";
import { StatsCards } from "@/features/dashboard/components/StatsCards";
import { BrandListTable } from "../components/BrandListTable";
import { BrandDetailsModal } from "../components/BrandDetailsModal";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { BrandDetail } from "@/types/brand.types";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useRouter } from "next/navigation";
import { useAdminApiStore } from "@/stores/useAdminApiStore";

export const BrandView = () => {
  const router = useRouter();
  const [selectedBrand, setSelectedBrand] = useState<BrandDetail | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const {
    profile,
    stats,
    brands,
    loadDashboard,
    loadBrandDetail,
    suspendBrand,
    reactivateBrand,
    approveBrand,
    rejectBrandApplication,
    logout,
  } = useAdminApiStore();

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

  const handleViewBrand = async (brand: BrandDetail) => {
    setIsDetailsModalOpen(true);
    setSelectedBrand(brand);
    if (brand.source !== "brand") return;

    try {
      const detail = await loadBrandDetail(brand);
      setSelectedBrand(detail);
    } catch {
      setSelectedBrand(brand);
    }
  };

  const handleDeleteBrand = (brand: BrandDetail) => {
    setSelectedBrand(brand);
    setIsDeleteModalOpen(true);
  };

  const handleApproveBrandAccount = (brand: BrandDetail) => {
    if (brand.id) void approveBrand(brand);
  };

  const handleReactivateBrand = (brand: BrandDetail) => {
    if (brand.id) void reactivateBrand(brand.id);
  };

  const handleConfirmDelete = () => {
    if (selectedBrand?.source === "brand-application") {
      void rejectBrandApplication(selectedBrand.id);
    } else if (selectedBrand?.source === "brand") {
      void suspendBrand(selectedBrand.id);
    }
    setIsDeleteModalOpen(false);
    setSelectedBrand(null);
  };

  return (
    <div className="flex min-h-screen w-full bg-[#FEFEFE]">
      {/* Responsive Sidebar */}
      <Sidebar
        activeNav="brand"
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

        {/* Brand List Table with Filter & Actions */}
        <BrandListTable
          brands={brands}
          onViewBrand={handleViewBrand}
          onDeleteBrand={handleDeleteBrand}
          onReactivateBrand={handleReactivateBrand}
          onApproveBrandAccount={handleApproveBrandAccount}
        />
      </main>

      {/* Brand Details Modal */}
      <BrandDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        brand={selectedBrand}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
