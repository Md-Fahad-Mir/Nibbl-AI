"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { SectionTabs } from "./SectionTabs";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useAdminApiStore } from "@/stores/useAdminApiStore";
import type { LucideIcon } from "lucide-react";

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

export const money = (value: unknown) => {
  const n = Number(value ?? 0);
  const text = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}$${text}`;
};

export const shortDate = (value: unknown) =>
  value ? new Date(String(value)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export const Kpi = ({
  label,
  value,
  tone = "",
  icon: Icon,
  iconTone = "bg-[#EEF0FF] text-[#3E3EDF]",
  sub,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  /** Master admin cards: an icon beside the label and value. */
  icon?: LucideIcon;
  iconTone?: string;
  sub?: React.ReactNode;
}) => (
  <div className="bg-white border border-[#ECECF5] rounded-2xl p-5 flex items-center gap-4">
    {Icon && (
      <span className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconTone}`}>
        <Icon className="w-6 h-6" />
      </span>
    )}
    <div className="min-w-0">
      <div className="text-xs font-semibold uppercase tracking-wider text-[#6B6B80]">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone || "text-[#1A1A2E]"}`}>{value}</div>
      {sub && <div className="text-xs text-[#9A9AB0] mt-0.5">{sub}</div>}
    </div>
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

export type Paged<T> = {
  items: T[];
  page: number;
  pages: number;
  total: number;
  size: number;
  setPage: (page: number) => void;
};

/** Client-side paging for lists the API returns whole. Changing ``resetKey``
 *  (a tab or filter) goes back to page 1. */
export const usePaged = <T,>(rows: T[], size = 10, resetKey = ""): Paged<T> => {
  const [state, setState] = useState({ key: resetKey, page: 1 });
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(state.key === resetKey ? state.page : 1, pages);
  const setPage = (page: number) => setState({ key: resetKey, page });
  return { items: rows.slice((current - 1) * size, current * size), page: current, pages, total: rows.length, size, setPage };
};

/** "1–10 of 86 brands" + page buttons (window of 5 around the current page). */
export const Pager = ({ paged, noun }: { paged: Omit<Paged<unknown>, "items">; noun: string }) => {
  const { page, pages, total, size, setPage } = paged;
  if (!total) return null;
  const first = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => first + i);
  const cls = "min-w-8 h-8 px-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-xs text-[#6B6B80]">
      <span>{(page - 1) * size + 1}–{Math.min(page * size, total)} of {total.toLocaleString()} {noun}</span>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(page - 1)} disabled={page === 1} className={`${cls} border border-[#E0E0F0]`}>‹</button>
          {numbers.map((n) => (
            <button key={n} onClick={() => setPage(n)}
              className={`${cls} ${n === page ? "bg-[#3E3EDF] text-white" : "border border-[#E0E0F0] text-[#1A1A2E]"}`}>{n}</button>
          ))}
          <button onClick={() => setPage(page + 1)} disabled={page === pages} className={`${cls} border border-[#E0E0F0]`}>›</button>
        </div>
      )}
    </div>
  );
};

// Small inline icons (the admin app has no icon library).
const svg = (path: React.ReactNode, className = "w-4 h-4") => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
    strokeLinejoin="round" className={`inline-block ${className}`} aria-hidden="true">{path}</svg>
);
export const CheckIcon = ({ className }: { className?: string }) => svg(<path d="M20 6 9 17l-5-5" />, className);
export const InfoIcon = ({ className }: { className?: string }) =>
  svg(<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>, className);
export const AlertIcon = ({ className }: { className?: string }) =>
  svg(<><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4M12 17h.01" /></>, className);
export const Stars = ({ rating }: { rating: number }) => (
  <span className="inline-flex gap-0.5 text-[#F59E0B]" aria-label={`${rating} stars`}>
    {Array.from({ length: Math.max(0, Math.min(5, Math.round(rating))) }, (_, i) => (
      <svg key={i} viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
      </svg>
    ))}
  </span>
);
