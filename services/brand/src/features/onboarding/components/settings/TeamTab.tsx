/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { UserPlus, MoreVertical, ShieldAlert, Award } from "lucide-react";
import { ApiRecord } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

interface Member {
  id: string;
  name: string;
  avatar: string;
  joinDate: string;
  email: string;
  role: string;
  lastActive: string;
}

interface TeamTabProps {
  onInviteClick: () => void;
}

const mapMember = (member: ApiRecord): Member => ({
  id: String(member.id),
  name: String(member.user_full_name ?? member.user_email ?? "Team member"),
  avatar: "/Notification/profile1.svg",
  joinDate:
    typeof member.created_at === "string"
      ? `Joined ${new Date(member.created_at).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })}`
      : "Joined",
  email: String(member.user_email ?? ""),
  role: String(member.role ?? "member"),
  lastActive: member.is_active === false ? "Inactive" : "Active",
});

export default function TeamTab({ onInviteClick }: TeamTabProps) {
  const members = useBrandApiStore((state) => state.members).map(mapMember);
  const removeMember = useBrandApiStore((state) => state.removeMember);
  const [removeError, setRemoveError] = useState("");

  const handleRemoveMember = async (member: Member) => {
    if (member.role.toLowerCase() === "owner") {
      setRemoveError("The brand owner cannot be removed.");
      return;
    }

    try {
      setRemoveError("");
      await removeMember(member.id);
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : "Could not remove member.");
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full text-left font-manrope">
      
      {/* Title + Stats Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end w-full gap-4">
        <div className="flex flex-col gap-1 text-left">
          <h2 className="font-jakarta font-extrabold text-2xl text-[#131B2E]">Team & Permissions</h2>
          <p className="text-xs text-[#454656] font-medium">Manage your organization&apos;s members and their access levels.</p>
        </div>
        <button onClick={onInviteClick} className="bg-gradient-to-r from-[#001BD2] to-[#2D3FEA] hover:opacity-95 text-white font-extrabold text-sm px-6 py-2.5 rounded-full flex items-center gap-2 border-none cursor-pointer shadow-md shadow-blue-500/10">
          <UserPlus className="w-4 h-4" /> Invite User
        </button>
      </div>

      {/* Stats Bento Card */}
      <div className="bg-white border border-[#C5C5D9]/10 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-[20px] p-6 w-[200px]">
        <span className="text-[10px] font-extrabold text-[#454656]/60 tracking-wider uppercase">Total Members</span>
        <h4 className="font-jakarta font-extrabold text-3xl text-[#131B2E] mt-2">{members.length}</h4>
      </div>

      {removeError && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm font-semibold rounded-xl px-4 py-3">
          {removeError}
        </div>
      )}

      {/* Member Directory Table */}
      <div className="w-full bg-white border border-[#C5C5D9]/10 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-[20px] overflow-hidden flex flex-col">
        <div className="bg-[#F2F3FF] px-8 py-5 border-b border-[#C5C5D9]/5">
          <h3 className="font-jakarta font-bold text-sm text-[#131B2E]">Member Directory</h3>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#C5C5D9]/10 bg-[#FAF8FF]">
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">Member</th>
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">Email Address</th>
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">Role</th>
                <th className="p-5 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">Last Active</th>
                <th className="p-5 text-right text-[10px] font-bold tracking-wider text-[#454656] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-[#C5C5D9]/10 hover:bg-[#F2F3FF]/30 transition-colors text-sm text-[#454656] font-manrope">
                  <td className="p-5 text-left flex items-center gap-3">
                    <img src={m.avatar} alt={m.name} className="w-10 h-10 rounded-full object-cover" />
                    <div className="flex flex-col text-left">
                      <span className="font-bold text-[#131B2E]">{m.name}</span>
                      <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{m.joinDate}</span>
                    </div>
                  </td>
                  <td className="p-5 text-left font-medium">{m.email}</td>
                  <td className="p-5 text-left">
                    <span className="bg-[#001BD2]/5 text-[#001BD2] font-bold text-xs px-2.5 py-0.5 rounded-full">
                      {m.role}
                    </span>
                  </td>
                  <td className="p-5 text-left font-medium">{m.lastActive}</td>
                  <td className="p-5 text-right">
                    {m.role.toLowerCase() === "owner" ? (
                      <span className="text-xs font-semibold text-slate-300">Owner</span>
                    ) : (
                      <button onClick={() => void handleRemoveMember(m)} className="bg-transparent border-none cursor-pointer text-slate-400 hover:text-[#131B2E]" title="Remove member"><MoreVertical className="w-4 h-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-sm font-semibold text-slate-400">
                    No team members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Blueprints Section */}
      <div className="flex flex-col gap-4 mt-4 w-full">
        <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">Role Blueprint</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {[
            { title: "Administrative Access", sub: "Full control over billing, team management, and global campaign settings.", icon: <ShieldAlert className="w-4 h-4 text-[#001BD2]" />, bg: "bg-[#001BD2]/10" },
            { title: "Campaign Manager", sub: "Create and edit campaigns, view analytics, but cannot modify team settings.", icon: <Award className="w-4 h-4 text-[#004956]" />, bg: "bg-[#004956]/10" }
          ].map((r, i) => (
            <div key={i} className="bg-white border border-[#C5C5D9]/10 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-[20px] p-6 flex flex-col gap-4 text-left">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${r.bg}`}>{r.icon}</div>
                <span className="font-bold text-[#131B2E] text-base">{r.title}</span>
              </div>
              <p className="text-xs text-[#454656] leading-relaxed font-medium">{r.sub}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
