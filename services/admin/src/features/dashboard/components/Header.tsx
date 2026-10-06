"use client";

import React from "react";
import Image from "next/image";
import { useAdminApiStore } from "@/stores/useAdminApiStore";
import { resolveBackendAssetUrl } from "@/lib/api/backendApi";

interface HeaderProps {
  adminName?: string;
  adminRole?: string;
  adminAvatarUrl?: string;
  unreadCount?: number;
  onToggleMobileMenu?: () => void;
  onNotificationClick?: () => void;
  onProfileClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  adminName = "Admin",
  adminRole = "Admin",
  adminAvatarUrl = "",
  unreadCount = 0,
  onToggleMobileMenu,
  onNotificationClick,
  onProfileClick,
}) => {
  const storeUnreadCount = useAdminApiStore((state) => state.unreadCount);
  const storeProfile = useAdminApiStore((state) => state.profile);
  const visibleUnreadCount = Math.max(unreadCount, storeUnreadCount);
  const visibleAvatarUrl =
    adminAvatarUrl ||
    resolveBackendAssetUrl(storeProfile?.avatar_url || storeProfile?.avatar);

  return (
    <header className="w-full min-w-0 min-h-[78px] bg-white rounded-[16px] shadow-[0px_2px_8px_rgba(0,0,0,0.1)] px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shrink-0 flex-wrap sm:flex-nowrap">
      {/* Left: Mobile Hamburger Button & Welcome Message */}
      <div className="flex items-center gap-3">
        {/* Mobile Menu Toggle Button */}
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-2 text-[#3E3EDF] hover:bg-[#3E3EDF]/10 rounded-lg lg:hidden cursor-pointer"
            aria-label="Open mobile menu"
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
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        {/* Welcome Message */}
        <div className="flex flex-col justify-center">
          <h1 className="font-inter text-[20px] sm:text-[24px] font-medium leading-[26px] sm:leading-[29px] text-[#3E3EDF]">
            Welcome,{adminName}
          </h1>
          <p className="font-inter text-[14px] sm:text-[16px] font-normal leading-[19px] text-[#575757]">
            Have a nice day!
          </p>
        </div>
      </div>

      {/* Right Controls: Notifications & Profile */}
      <div className="flex items-center gap-4 sm:gap-6 ml-auto">
        {onNotificationClick && (
          <button
            type="button"
            onClick={onNotificationClick}
            className="relative cursor-pointer focus:outline-none"
            title="Open notifications"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#E0E0E0] flex items-center justify-center transition-colors hover:bg-[#D5D5D5]">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#3E3EDF"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            {visibleUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#3E3EDF] text-white font-inter text-[12px] font-medium flex items-center justify-center shadow-sm">
                {visibleUnreadCount}
              </span>
            )}
          </button>
        )}

        {/* Profile Avatar & Info */}
        <button
          type="button"
          onClick={onProfileClick}
          className="flex min-w-0 items-center gap-3 rounded-[10px] p-1 transition-colors hover:bg-[#3E3EDF]/5 focus:outline-none"
          title="Open settings"
        >
          {/* Avatar Circle */}
          <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-[#3E3EDF] bg-gradient-to-br from-[#3E3EDF]/20 to-[#3E3EDF]/40 flex items-center justify-center font-inter font-semibold text-[#3E3EDF] text-base sm:text-lg overflow-hidden shrink-0">
            {visibleAvatarUrl ? (
              <Image
                src={visibleAvatarUrl}
                alt={`${adminName} profile`}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              adminName.slice(0, 2).toUpperCase()
            )}
          </div>

          <div className="hidden min-w-0 sm:flex flex-col justify-center">
            <span className="max-w-[140px] truncate font-inter text-[16px] font-normal leading-[19px] text-[#575757]">
              {adminName}
            </span>
            <span className="max-w-[140px] truncate font-inter text-[14px] font-normal leading-[17px] text-[#575757]">
              {adminRole}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
};
