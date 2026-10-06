"use client";

import { useState } from "react";
import { Lock, Laptop, Phone, Monitor } from "lucide-react";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  time: string;
  ip: string;
  isCurrent: boolean;
}

const mockSessions: Session[] = [
  { id: "s1", device: "Current browser", browser: "Web", location: "Unknown", time: "ACTIVE NOW", ip: "Current IP", isCurrent: true },
];

export default function SecurityTab() {
  const [sessions, setSessions] = useState<Session[]>(mockSessions);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const changePassword = useBrandApiStore((state) => state.changePassword);

  const handleRevoke = (id: string) => {
    setSessions(sessions.filter((session) => session.id !== id));
  };

  const handleLogoutAll = () => {
    setSessions(sessions.filter((session) => session.isCurrent));
  };

  const handlePasswordUpdate = async () => {
    try {
      setMessage("");
      if (!currentPassword || !newPassword) {
        setMessage("Enter both current and new password.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setMessage("New passwords do not match.");
        return;
      }
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update password.");
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full text-left font-manrope">
      <div className="flex flex-col gap-1 text-left w-full">
        <h2 className="font-jakarta font-extrabold text-2xl text-[#131B2E]">Protection</h2>
        <p className="text-xs text-[#454656] font-medium leading-relaxed max-w-[672px]">
          Manage account credentials and local session visibility for this dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full">
        <div className="lg:col-span-2 flex flex-col gap-6 w-full">
          <div className="bg-white border border-[#C5C5D9]/10 shadow-sm rounded-2xl overflow-hidden flex flex-col">
            <div className="bg-[#F2F3FF] px-8 py-5 border-b border-[#C5C5D9]/5 flex items-center gap-3">
              <Lock className="w-4 h-4 text-[#001BD2]" />
              <h3 className="font-jakarta font-bold text-sm text-[#131B2E]">Change Credentials</h3>
            </div>
            <div className="p-8 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#454656] uppercase tracking-wider pl-1">Current Password</label>
                <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type="password" placeholder="Current password" className="bg-[#F2F3FF] border border-[#C5C5D9]/15 rounded-xl px-4 py-3 text-sm outline-none text-[#131B2E]" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-[#454656] uppercase tracking-wider pl-1">New Password</label>
                  <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder="New password" className="bg-[#F2F3FF] border border-[#C5C5D9]/15 rounded-xl px-4 py-3 text-sm outline-none text-[#131B2E]" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-[#454656] uppercase tracking-wider pl-1">Confirm New Password</label>
                  <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="Confirm new password" className="bg-[#F2F3FF] border border-[#C5C5D9]/15 rounded-xl px-4 py-3 text-sm outline-none text-[#131B2E]" />
                </div>
              </div>
              <div className="flex justify-end items-center mt-2">
                {message && <span className="text-xs font-bold text-[#001BD2] mr-3">{message}</span>}
                <button onClick={handlePasswordUpdate} className="bg-[#001BD2]/10 hover:bg-[#001BD2]/15 px-6 py-2.5 rounded-full text-sm font-bold text-[#001BD2] border-none cursor-pointer">
                  Update Password
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 w-full">
          <div className="bg-white border border-[#C5C5D9]/10 shadow-sm rounded-2xl overflow-hidden flex flex-col">
            <div className="bg-[#F2F3FF] px-8 py-5 border-b border-[#C5C5D9]/5 flex justify-between items-center w-full">
              <h3 className="font-jakarta font-bold text-sm text-[#131B2E] flex items-center gap-2">Active Sessions</h3>
              <span className="bg-[#001BD2]/10 text-[#001BD2] font-bold text-[9px] px-2 py-0.5 rounded tracking-wide">{sessions.length} LIVE</span>
            </div>
            <div className="flex flex-col">
              {sessions.map((session) => (
                <div key={session.id} className="px-6 py-4 flex justify-between items-center border-b border-[#C5C5D9]/10 relative">
                  <div className="flex gap-3 items-start">
                    <div className="w-10 h-10 rounded-lg bg-[#E2E7FF] flex items-center justify-center flex-shrink-0 text-[#001BD2]">
                      {session.device.includes("Phone") ? <Phone className="w-5 h-5" /> : session.device.includes("Mac") ? <Laptop className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-[#131B2E]">{session.device}</span>
                      <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{session.browser} - {session.location}</span>
                      <span className="text-[9px] font-extrabold text-[#059669] uppercase tracking-wider mt-1">{session.time}</span>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <button onClick={() => handleRevoke(session.id)} className="bg-transparent border-none cursor-pointer text-xs font-bold text-[#BA1A1A] hover:underline">Revoke</button>
                  )}
                </div>
              ))}
            </div>
            <div className="bg-[#F2F3FF] p-6 flex border-t border-[#C5C5D9]/10">
              <button onClick={handleLogoutAll} className="w-full py-2.5 bg-white border border-[#BA1A1A]/20 hover:bg-red-50 text-[#BA1A1A] font-extrabold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer">
                Logout all visible devices
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
