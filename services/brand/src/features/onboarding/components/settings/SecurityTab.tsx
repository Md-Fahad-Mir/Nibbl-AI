"use client";

import { useEffect, useState } from "react";
import { Lock, Laptop, Phone, Monitor } from "lucide-react";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatDate, formatTime } from "../../utils/backendMappers";

const deviceLabel = (agent: unknown) => {
  const ua = String(agent ?? "");
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
};

export default function SecurityTab() {
  const [security, setSecurity] = useState<ApiRecord | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const changePassword = useBrandApiStore((state) => state.changePassword);
  const members = useBrandApiStore((state) => state.members);
  const profileId = useBrandApiStore((state) => String(state.profile?.id ?? ""));
  const isOwner = members.some((m) => String(m.user) === profileId && m.role === "owner");

  useEffect(() => {
    let live = true;
    apiClient
      .request<ApiRecord>(backendApi.users.sessions)
      .then((data) => live && setSecurity(data))
      .catch((err) => live && setSessionMessage(err instanceof Error ? err.message : "Could not load sessions."));
    return () => {
      live = false;
    };
  }, []);

  const sessions = (Array.isArray(security?.sessions) ? security.sessions : []) as ApiRecord[];

  const handleSignOutOthers = async () => {
    setSigningOut(true);
    setSessionMessage("");
    try {
      const result = await apiClient.request<ApiRecord>(backendApi.users.signOutOtherSessions);
      setSecurity(await apiClient.request<ApiRecord>(backendApi.users.sessions));
      setSessionMessage(`Signed out ${String(result.signed_out ?? 0)} other session(s).`);
    } catch (err) {
      setSessionMessage(err instanceof Error ? err.message : "Could not sign out other sessions.");
    } finally {
      setSigningOut(false);
    }
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
          Manage your password and the devices signed in to your account.
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
          <div className="bg-white border border-[#C5C5D9]/10 shadow-sm rounded-2xl p-6 flex flex-col gap-3 text-xs text-[#454656]">
            <div className="flex justify-between"><span>Sign-in method</span><b className="text-[#131B2E]">{String(security?.sign_in_method ?? "Email and password")}</b></div>
            <div className="flex justify-between"><span>Passwordless sign-in</span><b className="text-[#131B2E]">{security?.passwordless_enabled ? "On" : "Off"}</b></div>
            <div className="flex justify-between"><span>Most recent sign-in</span><b className="text-[#131B2E]">{security?.last_sign_in ? `${formatDate(String(security.last_sign_in))} ${formatTime(String(security.last_sign_in))}` : "—"}</b></div>
          </div>

          <div className="bg-white border border-[#C5C5D9]/10 shadow-sm rounded-2xl overflow-hidden flex flex-col">
            <div className="bg-[#F2F3FF] px-8 py-5 border-b border-[#C5C5D9]/5 flex justify-between items-center w-full">
              <h3 className="font-jakarta font-bold text-sm text-[#131B2E] flex items-center gap-2">Active Sessions</h3>
              <span className="bg-[#001BD2]/10 text-[#001BD2] font-bold text-[9px] px-2 py-0.5 rounded tracking-wide">{sessions.length} ACTIVE</span>
            </div>
            <div className="flex flex-col">
              {sessions.map((session) => {
                const label = deviceLabel(session.user_agent);
                return (
                  <div key={String(session.id)} className="px-6 py-4 flex gap-3 items-start border-b border-[#C5C5D9]/10">
                    <div className="w-10 h-10 rounded-lg bg-[#E2E7FF] flex items-center justify-center flex-shrink-0 text-[#001BD2]">
                      {/iOS|Android/.test(label) ? <Phone className="w-5 h-5" /> : /Mac/.test(label) ? <Laptop className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-[#131B2E]">{label}</span>
                      <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        {String(session.ip_address ?? "Unknown IP")} · signed in {formatDate(String(session.signed_in_at ?? ""))}
                      </span>
                      <span className="text-[9px] font-extrabold text-[#059669] uppercase tracking-wider mt-1">
                        {session.current ? "This device" : `Last active ${formatDate(String(session.last_used_at ?? ""))}`}
                      </span>
                    </div>
                  </div>
                );
              })}
              {security && sessions.length === 0 && (
                <p className="px-6 py-4 text-xs text-slate-400">Sign in again to see this device listed.</p>
              )}
            </div>
            <div className="bg-[#F2F3FF] p-6 flex flex-col gap-2 border-t border-[#C5C5D9]/10">
              <button onClick={() => void handleSignOutOthers()} disabled={signingOut}
                className="w-full py-2.5 bg-white border border-[#BA1A1A]/20 hover:bg-red-50 text-[#BA1A1A] font-extrabold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50">
                {signingOut ? "Signing out…" : "Sign out other sessions"}
              </button>
              {sessionMessage && <span className="text-[11px] font-bold text-[#001BD2] text-center">{sessionMessage}</span>}
            </div>
          </div>

          {isOwner && (
            <div className="bg-white border border-[#C5C5D9]/10 shadow-sm rounded-2xl p-6 flex flex-col gap-2">
              <h3 className="font-jakarta font-bold text-sm text-[#131B2E]">Close account</h3>
              <p className="text-xs text-[#454656] leading-relaxed">
                Only the brand Owner can request account closure. Contact Nibbl Support to close this brand account.
              </p>
            </div>
          )}

          {/* Master Settings §6: Klaviyo shown as Coming Soon — Scale */}
          <div className="bg-[#F8F9FF] border border-[#EAEDFF] rounded-2xl p-6 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <h3 className="font-jakarta font-bold text-sm text-[#131B2E]">Klaviyo</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Coming soon — Scale</span>
            </div>
            <p className="text-xs text-[#454656] leading-relaxed">
              Connect your own Klaviyo account to sync eligible opted-in customer information. Nibbl&apos;s system
              emails and texts are separate.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
