"use client";

import React, { useState } from "react";
import Image from "next/image";
import { SidebarNavItem } from "@/types/dashboard.types";

interface SidebarProps {
  activeNav?: SidebarNavItem;
  onNavSelect?: (item: SidebarNavItem) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeNav = "dashboard",
  onNavSelect,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const [selected, setSelected] = useState<SidebarNavItem>(activeNav);

  const handleSelect = (item: SidebarNavItem) => {
    setSelected(item);
    if (onNavSelect) onNavSelect(item);
    if (onCloseMobile) onCloseMobile();
  };

  const navItems: {
    id: SidebarNavItem;
    label: string;
    icon: (isActive: boolean) => React.ReactNode;
    isDanger?: boolean;
  }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: (isActive) => (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="2"
            y="2"
            width="7"
            height="7"
            rx="1.5"
            fill={isActive ? "#FEFEFE" : "#3E3EDF"}
          />
          <rect
            x="11"
            y="2"
            width="7"
            height="7"
            rx="1.5"
            fill={isActive ? "#FEFEFE" : "#3E3EDF"}
          />
          <rect
            x="2"
            y="11"
            width="7"
            height="7"
            rx="1.5"
            fill={isActive ? "#FEFEFE" : "#3E3EDF"}
          />
          <rect
            x="11"
            y="11"
            width="7"
            height="7"
            rx="1.5"
            fill={isActive ? "#FEFEFE" : "#3E3EDF"}
          />
        </svg>
      ),
    },
    {
      id: "earnings",
      label: "Earnings",
      icon: (isActive) => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isActive ? "#FEFEFE" : "#3E3EDF"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      ),
    },
    {
      id: "users",
      label: "Users",
      icon: (isActive) => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isActive ? "#FEFEFE" : "#3E3EDF"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: "brand",
      label: "Brand",
      icon: (isActive) => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isActive ? "#FEFEFE" : "#3E3EDF"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      ),
    },
    {
      id: "promo-codes",
      label: "Promo Codes",
      icon: (isActive) => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isActive ? "#FEFEFE" : "#3E3EDF"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
          <path d="M11 8l5 5" />
        </svg>
      ),
    },
    {
      id: "campaign-approvals",
      label: "Campaign Approvals",
      icon: (isActive) => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isActive ? "#FEFEFE" : "#3E3EDF"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 11l3 3 8-8" />
          <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
        </svg>
      ),
    },
    {
      id: "review-flags",
      label: "Flagged Reviews",
      icon: (isActive) => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isActive ? "#FEFEFE" : "#3E3EDF"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      ),
    },
    {
      id: "referrals",
      label: "Referrals",
      icon: (isActive) => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isActive ? "#FEFEFE" : "#3E3EDF"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <path d="M16 11h6M19 8v6" />
        </svg>
      ),
    },
    {
      id: "brand-discovery",
      label: "Brand Discovery",
      icon: (isActive) => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isActive ? "#FEFEFE" : "#3E3EDF"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      ),
    },
    {
      id: "payout-reviews",
      label: "Payout Reviews",
      icon: (isActive) => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isActive ? "#FEFEFE" : "#3E3EDF"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 12l2 2 4-4" />
          <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
      ),
    },
    {
      id: "withdraw-request",
      label: "Withdraw Request",
      icon: (isActive) => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isActive ? "#FEFEFE" : "#3E3EDF"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      icon: (isActive) => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isActive ? "#FEFEFE" : "#3E3EDF"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
    {
      id: "logout",
      label: "Log Out",
      isDanger: true,
      icon: () => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FF5C5C"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen bg-[#F9F9F9] shadow-[7px_19px_42.7px_rgba(0,0,0,0.25)] flex flex-col items-center py-10 px-6 shrink-0 z-50 transition-transform duration-300 w-[280px] lg:w-[326px] overflow-y-auto ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Mobile Close Button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-900 lg:hidden cursor-pointer"
            aria-label="Close sidebar menu"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {/* Brand Logo */}
        <div className="w-[150px] h-[57px] flex items-center justify-center mb-10 shrink-0">
          <Image
            src="/mainImage/logo.svg"
            alt="NibblAI Logo"
            width={150}
            height={57}
            priority
            className="w-full h-auto object-contain"
          />
        </div>

        {/* Nav Menu Options (Frame 2147228429) */}
        <nav className="w-full flex flex-col gap-4">
          {navItems.map((item) => {
            const isActive = selected === item.id;
            const isLogout = item.isDanger;

            let btnClass =
              "w-full h-[56px] px-4 flex items-center gap-4 rounded-[8px] transition-all cursor-pointer font-inter text-[16px] lg:text-[18px] font-medium leading-[22px]";

            if (isActive && !isLogout) {
              btnClass += " bg-[#3E3EDF] text-[#FEFEFE] shadow-md";
            } else if (isLogout) {
              btnClass +=
                " bg-transparent text-[#FF5C5C] hover:bg-[#FF5C5C]/10";
            } else {
              btnClass +=
                " bg-transparent text-[#3E3EDF] hover:bg-[#3E3EDF]/10";
            }

            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={btnClass}
              >
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  {item.icon(isActive)}
                </div>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
