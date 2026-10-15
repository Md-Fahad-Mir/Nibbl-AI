"use client";

import { Star, Ticket, UserRound, WalletMinimal } from "lucide-react";
import Image from "next/image";
import UserAvatar from "@/components/UserAvatar";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";
import { imageUrl, text } from "../lib/offerMappers";

// Master shopper tabs, in order. "scan" is the My Offers page.
const TABS = [
  { id: "offer", label: "For You", Icon: Star },
  { id: "scan", label: "My Offers", Icon: Ticket },
  { id: "wallet", label: "Wallet", Icon: WalletMinimal },
  { id: "profile", label: "Profile", Icon: UserRound },
] as const;

interface HeaderProps {
  activeTab?: "offer" | "wallet" | "scan" | "profile" | "notification";
  onTabChange?: (tab: "offer" | "wallet" | "scan" | "profile" | "notification") => void;
  unreadCount?: number;
}

export default function Header({ activeTab = "offer", onTabChange, unreadCount = 0 }: HeaderProps) {
  // Master: the My Offers badge counts pending actions (receipts to submit +
  // review opportunities), not total offers.
  const pendingActions = useConsumerApiStore(
    (state) => state.reservations.length + state.reviewOpportunities.length
  );
  const user = useConsumerApiStore((state) => state.user);
  const avatar = imageUrl(user?.avatar_url ?? user?.avatar ?? user?.profile_image, "");
  const displayName = text(user?.full_name ?? user?.name, text(user?.email, "User profile"));

  return (
    <header className="w-full bg-[#FEFEFE] border-b border-gray-100 py-4 px-6 md:px-12 flex justify-between items-center relative z-20 font-sans">
      <div className="flex items-center gap-4 sm:gap-8 md:gap-16">
        {/* Logo */}
        <div onClick={() => onTabChange?.("offer")} className="cursor-pointer">
          <Image
            src="/logo/logoTiny.svg"
            alt="nibblAI Logo"
            width={130}
            height={50}
            priority
            className="h-auto w-auto"
          />
        </div>

        {/* Navigation Items (hidden on mobile, shown on md and up) */}
        <nav className="hidden md:flex items-center gap-3">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onTabChange?.(id)}
              className={`px-5 py-1.5 font-medium text-sm rounded-md transition-all cursor-pointer focus:outline-none ${
                activeTab === id
                  ? "text-white bg-[#3E3EDF] shadow-sm hover:opacity-90 active:scale-[0.98]"
                  : "text-[#575757] hover:text-black"
              }`}
            >
              {label}
              {id === "scan" && pendingActions > 0 && (
                <span className="ml-1.5 inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-[#E65353] text-white text-[10px] font-bold align-middle">
                  {pendingActions > 99 ? "99+" : pendingActions}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button
          onClick={() => onTabChange?.("notification")}
          className={`relative cursor-pointer w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center hover:bg-gray-50 shadow-sm active:scale-[0.95] transition-all focus:outline-none ${
            activeTab === "notification" ? "bg-gray-100/80" : ""
          }`}
        >
          <svg className="w-5 h-5 text-[#3E3EDF]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {/* Notification Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-[#3E3EDF] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Profile Avatar button */}
        <div className="relative">
          <button
            onClick={() => onTabChange?.("profile")}
            title="View Profile"
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 hover:border-[#3E3EDF] active:scale-[0.95] transition-all cursor-pointer block focus:outline-none"
          >
            <UserAvatar
              src={avatar}
              alt={displayName}
              className="h-full w-full"
              iconClassName="h-5 w-5"
              priority
            />
          </button>
        </div>
      </div>

      {/* Master shopper navigation: bottom tabs on phone-sized screens */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]"
        aria-label="Main">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} type="button" onClick={() => onTabChange?.(id)}
            aria-current={activeTab === id ? "page" : undefined}
            className={`relative flex flex-col items-center justify-center gap-0.5 h-16 text-[11px] font-medium cursor-pointer ${
              activeTab === id ? "text-[#3E3EDF]" : "text-[#8A8A8A]"
            }`}>
            <Icon className="w-6 h-6" />
            {label}
            {id === "scan" && pendingActions > 0 && (
              <span className="absolute top-2 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#E65353] text-white text-[10px] font-bold">
                {pendingActions > 99 ? "99+" : pendingActions}
              </span>
            )}
          </button>
        ))}
      </nav>
    </header>
  );
}
