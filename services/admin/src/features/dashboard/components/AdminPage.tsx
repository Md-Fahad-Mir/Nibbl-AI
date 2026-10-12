"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { SectionTabs } from "./SectionTabs";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useAdminApiStore } from "@/stores/useAdminApiStore";

/** Sidebar + header frame shared by the Master admin pages. */
export const AdminPage = ({
  active,
  title,
  subtitle,
  actions,
  children,
}: {
  active: SidebarNavItem;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { profile, loadProfile, logout } = useAdminApiStore();

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleNavSelect = (item: SidebarNavItem) => {
    if (item === "logout") {
      logout();
      router.push("/");
      return;
    }
    router.push(`/${item}`);
  };

  return (
    <div className="flex min-h-screen w-full bg-[#FEFEFE]">
      <Sidebar activeNav={active} onNavSelect={handleNavSelect} isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)} />
      <main className="flex-1 w-full min-w-0 min-h-screen p-4 sm:p-6 md:p-8 flex flex-col gap-6 items-stretch bg-[#FEFEFE] overflow-x-hidden font-inter">
        <Header adminName={String(profile?.full_name || profile?.email || "Admin")} adminRole={String(profile?.role || "Admin")}
          unreadCount={0} onToggleMobileMenu={() => setIsMobileMenuOpen(true)} onProfileClick={() => router.push("/settings")} />
        <SectionTabs current={active} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A2E]">{title}</h1>
            <p className="text-sm text-[#6B6B80] mt-1">{subtitle}</p>
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
};

export const money = (value: unknown) =>
  `$${Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const shortDate = (value: unknown) =>
  value ? new Date(String(value)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export const Kpi = ({ label, value, tone = "" }: { label: string; value: React.ReactNode; tone?: string }) => (
  <div className="bg-white border border-[#ECECF5] rounded-2xl p-5">
    <div className="text-xs font-semibold uppercase tracking-wider text-[#9A9AB0]">{label}</div>
    <div className={`text-2xl font-bold mt-1 ${tone || "text-[#1A1A2E]"}`}>{value}</div>
  </div>
);

export const Notice = ({ error, notice }: { error?: string; notice?: string }) => (
  <>
    {notice && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-lg px-3 py-2">{notice}</div>}
    {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
  </>
);

export const selectCls = "h-9 px-3 rounded-full border border-[#E0E0F0] bg-white text-xs font-semibold cursor-pointer";
export const btn = "h-10 px-4 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50";
