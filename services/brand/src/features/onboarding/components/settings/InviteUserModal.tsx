"use client";

import { useState } from "react";
import { Mail, Check, X } from "lucide-react";

interface InviteUserModalProps {
  onClose: () => void;
  onSend: (email: string, role: string) => void | Promise<void>;
}

export default function InviteUserModal({ onClose, onSend }: InviteUserModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Manager");

  const getPermissions = () => {
    switch (role) {
      case "Admin":
        return [
          { text: "Can manage active campaigns and adjust budgets.", check: true },
          { text: "Can view team performance metrics and analytics.", check: true },
          { text: "Can edit campaign assets and creative details.", check: true },
          { text: "Can delete team members and adjust core settings.", check: true }
        ];
      case "Reviewer":
        return [
          { text: "Cannot manage campaigns or adjust budgets.", check: false },
          { text: "Can view team performance metrics and analytics.", check: true },
          { text: "Cannot edit campaign assets and creative details.", check: false },
          { text: "Cannot delete team members or adjust settings.", check: false }
        ];
      default: // Manager
        return [
          { text: "Can manage active campaigns and adjust budgets.", check: true },
          { text: "Can view team performance metrics and analytics.", check: true },
          { text: "Can edit campaign assets and creative details.", check: true },
          { text: "Cannot delete team members or adjust core settings.", check: false }
        ];
    }
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-50 transition-opacity"></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[896px] bg-white shadow-[0px_24px_48px_rgba(19,27,46,0.08)] rounded-[20px] overflow-hidden z-50 flex flex-col font-manrope animate-scale-up">
        
        {/* Modal Header */}
        <div className="bg-[#F2F3FF] px-8 py-5 flex justify-between items-center border-b border-[#C5C5D9]/15">
          <h3 className="font-jakarta font-extrabold text-lg text-[#131B2E] tracking-tight">Invite Team Member</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white hover:bg-slate-50 border-none cursor-pointer flex items-center justify-center text-slate-500 font-bold">✕</button>
        </div>

        {/* Modal Body */}
        <div className="p-8 flex flex-col md:flex-row gap-8 items-stretch">
          {/* Left Column: Form */}
          <div className="flex-1 flex flex-col gap-6 text-left">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#454656] uppercase tracking-wider pl-1">Email Address</label>
              <div className="bg-[#F2F3FF] rounded-2xl flex items-center px-4 py-3 gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <input type="email" placeholder="e.g. sarah.chen@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-transparent border-none outline-none text-sm font-semibold text-[#131B2E] flex-1" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#454656] uppercase tracking-wider pl-1">Select Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="bg-[#F2F3FF] border-none rounded-2xl px-5 py-3.5 text-sm font-semibold text-[#131B2E] outline-none cursor-pointer">
                <option>Manager</option>
                <option>Admin</option>
                <option>Reviewer</option>
              </select>
              <span className="text-[10px] text-[#454656]/60 font-bold uppercase tracking-wider pl-1 mt-1">Selected: {role} Tier</span>
            </div>
          </div>

          {/* Right Column: Permission Overview */}
          <div className="w-full md:w-[328px] bg-[#F2F3FF] border border-[#C5C5D9]/15 rounded-2xl p-6 flex flex-col text-left">
            <span className="text-xs font-bold text-[#131B2E] uppercase tracking-wider mb-4">Role Permissions</span>
            <div className="flex flex-col gap-4 flex-1">
              {getPermissions().map((p, i) => (
                <div key={i} className="flex gap-2.5 items-start">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0 ${p.check ? "bg-[#2D3FEA] text-white" : "bg-slate-300 text-slate-500"}`}>
                    {p.check ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
                  </div>
                  <span className={`text-xs font-semibold leading-normal ${p.check ? "text-[#454656]" : "text-slate-400 line-through"}`}>{p.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#FAF8FF] px-8 py-5 border-t border-[#C5C5D9]/15 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 bg-transparent hover:bg-slate-50 text-xs font-extrabold text-[#001BD2] border-none rounded-full cursor-pointer uppercase tracking-wider">Cancel</button>
          <button onClick={async () => { await onSend(email, role); onClose(); }} className="px-6 py-2.5 bg-gradient-to-r from-[#001BD2] to-[#2D3FEA] hover:opacity-95 text-xs font-extrabold text-white border-none rounded-full cursor-pointer shadow-[0px_8px_16px_rgba(0,27,210,0.15)] uppercase tracking-wider">Send Invitation</button>
        </div>

      </div>
    </>
  );
}
