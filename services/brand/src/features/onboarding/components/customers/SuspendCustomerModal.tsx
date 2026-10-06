"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";

interface SuspendCustomerModalProps {
  isOpen: boolean;
  customerName: string;
  isSuspended: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
  error?: string;
}

export default function SuspendCustomerModal({
  isOpen,
  customerName,
  isSuspended,
  onConfirm,
  onClose,
  isLoading = false,
  error = "",
}: SuspendCustomerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-manrope">
      <div className="bg-white rounded-[32px] overflow-hidden shadow-2xl max-w-[480px] w-full flex flex-col text-center transform transition-transform scale-100 duration-300">
        
        {/* Modal Header */}
        <div className="bg-[#F2F3FF] px-10 py-10 flex flex-col items-center gap-6">
          {/* Icon wrapper */}
          <div className="w-20 h-20 bg-[#BA1A1A]/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-9 h-9 text-[#BA1A1A]" />
          </div>
          
          <div className="flex flex-col gap-2">
            <h3 className="font-jakarta font-extrabold text-2xl text-[#131B2E] tracking-tight leading-8">
              {isSuspended ? "Unsuspend Customer Account?" : "Suspend Customer Account?"}
            </h3>
            <p className="text-sm leading-6 text-[#454656] font-medium mt-2">
              {isSuspended 
                ? `Are you sure you want to unsuspend ${customerName}? This action will restore their ability to participate in your brand's rebate and review offers.`
                : `Are you sure you want to suspend ${customerName} from all rebate and review offers for your brand? This action will prevent them from participating in future campaigns.`
              }
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="bg-[#F2F3FF] px-8 pb-8 flex flex-col gap-3">
          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-left text-xs font-semibold text-[#BA1A1A]">
              {error}
            </div>
          )}
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full bg-[#BA1A1A] hover:bg-[#A31616] text-white font-bold text-sm py-4 px-6 rounded-full transition-colors border-none shadow-[0px_10px_15px_-3px_rgba(186,26,26,0.2)] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? "Saving..." : isSuspended ? "Unsuspend Customer" : "Suspend Customer"}
          </button>
          <button
            onClick={onClose}
            className="w-full bg-[#E2E7FF] hover:bg-[#D0D7FF] text-[#001BD2] font-bold text-sm py-4 px-6 rounded-full transition-colors border-none cursor-pointer"
          >
            Cancel
          </button>
        </div>

        {/* Branding Subtle Hint */}
        <div className="bg-white py-4 flex items-center justify-center gap-2 border-t border-[#C5C5D9]/10">
          <ShieldCheck className="w-3.5 h-3.5 text-[#131B2E]/40" />
          <span className="text-[10px] font-extrabold text-[#131B2E]/40 tracking-widest uppercase">
            Protected by Sovereign Identity
          </span>
        </div>

      </div>
    </div>
  );
}
