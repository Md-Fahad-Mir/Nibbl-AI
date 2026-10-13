"use client";

import { useState } from "react";
import BrandProfileTab from "./BrandProfileTab";
import TeamTab from "./TeamTab";
import SecurityTab from "./SecurityTab";
import TrackingTab from "./TrackingTab";
import NotificationsTab from "./NotificationsTab";
import AccountSupportTab from "./AccountSupportTab";
import InviteUserModal from "./InviteUserModal";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

export default function SettingsView() {
  const [activeTabSetting, setActiveTabSetting] = useState<"Brand Profile" | "Team" | "Notifications" | "Tracking" | "Security" | "Account & Support">("Brand Profile");
  const [showInvite, setShowInvite] = useState(false);
  const [message, setMessage] = useState("");
  const inviteMember = useBrandApiStore((state) => state.inviteMember);

  const handleSendInvite = async (email: string, role: string) => {
    try {
      await inviteMember(email, role);
      setMessage(`Invitation sent to ${email}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not invite member.");
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left font-manrope">
      
      {/* Top Header Integration with Search & Save button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end w-full gap-4">
        
        {/* Left header area with title & search input */}
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight leading-none">
            Settings
          </h2>
          <p className="text-xs text-[#454656] font-medium mt-1">
            Manage your brand, team, notifications, tracking, and security.
          </p>
        </div>

        {message && (
          <span className="bg-[#E2E7FF] text-[#001BD2] font-bold text-xs px-4 py-2 rounded-full">
            {message}
          </span>
        )}
      </div>

      {/* Settings Navigation Tabs Switcher */}
      <div className="bg-[#F2F3FF] p-1.5 rounded-3xl flex flex-wrap items-center gap-1.5 w-fit border border-[#C5C5D9]/5 relative z-10">
        {(["Brand Profile", "Team", "Notifications", "Tracking", "Security", "Account & Support"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTabSetting(tab)}
            className={`px-6 py-2 text-xs font-bold rounded-full transition-all border-none cursor-pointer ${
              activeTabSetting === tab 
                ? "bg-white text-[#001BD2] shadow-sm" 
                : "text-[#454656] hover:text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Tab Contents */}
      <div className="w-full mt-2 relative">
        {activeTabSetting === "Brand Profile" && <BrandProfileTab />}
        {activeTabSetting === "Team" && <TeamTab onInviteClick={() => setShowInvite(true)} />}
        {activeTabSetting === "Notifications" && <NotificationsTab />}
        {activeTabSetting === "Tracking" && <TrackingTab />}
        {activeTabSetting === "Security" && <SecurityTab />}
        {activeTabSetting === "Account & Support" && <AccountSupportTab />}
      </div>

      {/* Invitation Modal popup */}
      {showInvite && (
        <InviteUserModal
          onClose={() => setShowInvite(false)}
          onSend={handleSendInvite}
        />
      )}

    </div>
  );
}
