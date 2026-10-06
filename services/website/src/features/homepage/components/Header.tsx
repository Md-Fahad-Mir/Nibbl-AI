"use client";

import { useState } from "react";
import Image from "next/image";
import UserAvatar from "@/components/UserAvatar";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";
import { imageUrl, text } from "../lib/offerMappers";

interface HeaderProps {
  activeTab?: "offer" | "wallet" | "scan" | "profile" | "notification";
  onTabChange?: (tab: "offer" | "wallet" | "scan" | "profile" | "notification") => void;
  unreadCount?: number;
}

export default function Header({ activeTab = "offer", onTabChange, unreadCount = 0 }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const user = useConsumerApiStore((state) => state.user);
  const avatar = imageUrl(user?.avatar_url ?? user?.avatar ?? user?.profile_image, "");
  const displayName = text(user?.full_name ?? user?.name, text(user?.email, "User profile"));

  return (
    <header className="w-full bg-[#FEFEFE] border-b border-gray-100 py-4 px-6 md:px-12 flex justify-between items-center relative z-20 font-sans">
      <div className="flex items-center gap-4 sm:gap-8 md:gap-16">
        {/* Mobile Menu Toggle button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 cursor-pointer text-[#3E3EDF] transition-all focus:outline-none flex-shrink-0"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

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
        <nav className="hidden md:flex items-center gap-6">
          <button
            onClick={() => onTabChange?.("offer")}
            className={`px-5 py-1.5 font-medium text-sm rounded-md transition-all cursor-pointer focus:outline-none ${
              activeTab === "offer"
                ? "text-white bg-[#3E3EDF] shadow-sm hover:opacity-90 active:scale-[0.98]"
                : "text-[#575757] hover:text-black"
            }`}
          >
            Offer
          </button>
          <button
            onClick={() => {
              // Scroll to Wallet card or route to home first then scroll
              onTabChange?.("wallet");
            }}
            className={`px-5 py-1.5 font-medium text-sm rounded-md transition-all cursor-pointer focus:outline-none ${
              activeTab === "wallet"
                ? "text-white bg-[#3E3EDF] shadow-sm hover:opacity-90 active:scale-[0.98]"
                : "text-[#575757] hover:text-black"
            }`}
          >
            Wallet
          </button>
          <button
            onClick={() => onTabChange?.("scan")}
            className={`px-5 py-1.5 font-medium text-sm rounded-md transition-all cursor-pointer focus:outline-none ${
              activeTab === "scan"
                ? "text-white bg-[#3E3EDF] shadow-sm hover:opacity-90 active:scale-[0.98]"
                : "text-[#575757] hover:text-black"
            }`}
          >
            Scan
          </button>
          <button
            onClick={() => onTabChange?.("profile")}
            className={`px-5 py-1.5 font-medium text-sm rounded-md transition-all cursor-pointer focus:outline-none ${
              activeTab === "profile"
                ? "text-white bg-[#3E3EDF] shadow-sm hover:opacity-90 active:scale-[0.98]"
                : "text-[#575757] hover:text-black"
            }`}
          >
            Profile
          </button>
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

      {/* Mobile Dropdown Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-[#FEFEFE] border-b border-gray-100 shadow-lg px-6 py-4 flex flex-col gap-4 z-50 animate-slide-down">
          <button
            onClick={() => {
              onTabChange?.("offer");
              setIsMenuOpen(false);
            }}
            className={`w-full text-left py-2 font-medium text-base transition-colors focus:outline-none cursor-pointer ${
              activeTab === "offer" ? "text-[#3E3EDF]" : "text-[#575757]"
            }`}
          >
            Offer
          </button>
          <button
            onClick={() => {
              onTabChange?.("wallet");
              setIsMenuOpen(false);
            }}
            className={`w-full text-left py-2 font-medium text-base transition-colors focus:outline-none cursor-pointer ${
              activeTab === "wallet" ? "text-[#3E3EDF]" : "text-[#575757]"
            }`}
          >
            Wallet
          </button>
          <button
            onClick={() => {
              onTabChange?.("scan");
              setIsMenuOpen(false);
            }}
            className={`w-full text-left py-2 font-medium text-base transition-colors focus:outline-none cursor-pointer ${
              activeTab === "scan" ? "text-[#3E3EDF]" : "text-[#575757]"
            }`}
          >
            Scan
          </button>
          <button
            onClick={() => {
              onTabChange?.("profile");
              setIsMenuOpen(false);
            }}
            className={`w-full text-left py-2 font-medium text-base transition-colors focus:outline-none cursor-pointer ${
              activeTab === "profile" ? "text-[#3E3EDF]" : "text-[#575757]"
            }`}
          >
            Profile
          </button>
        </div>
      )}
    </header>
  );
}
