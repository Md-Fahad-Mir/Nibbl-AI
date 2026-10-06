"use client";

import { ArrowLeft, Star } from "lucide-react";
import { CustomerData } from "./CustomerLedger";
import { customerInitials } from "../../utils/backendMappers";

interface CustomerProfileViewProps {
  customer: CustomerData;
  onBack: () => void;
  onToggleSuspend: (c: CustomerData) => void;
}

export default function CustomerProfileView({ customer, onBack, onToggleSuspend }: CustomerProfileViewProps) {
  const receipts = customer.recentReceipts || [];
  const activityBars = [
    customer.claims,
    customer.reviews,
    receipts.length,
    customer.status === "Active" ? 2 : 0,
    1,
    Math.max(customer.claims, 1),
  ].map((value) => Math.min(100, 20 + value * 14));

  const receiptStatusClass = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized.includes("approved") || normalized.includes("redeemed")) {
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    }
    if (normalized.includes("rejected") || normalized.includes("declined")) {
      return "bg-red-50 text-red-700 border border-red-200";
    }
    return "bg-amber-50 text-amber-700 border border-amber-200";
  };

  return (
    <div className="flex flex-col gap-8 w-full text-left font-manrope animate-slide-up">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-[#454656] hover:text-[#001BD2] bg-transparent border-none cursor-pointer w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to Customer Directory
      </button>

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center w-full bg-white border border-[#C5C5D9]/10 p-8 rounded-[24px] gap-6">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-md flex-shrink-0 bg-[#D0E1FB]">
            {customer.avatar ? (
              <img src={customer.avatar} alt={customer.name} className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-2xl font-extrabold text-[#001BD2]">
                {customerInitials(customer.name)}
              </span>
            )}
          </div>
          <div className="flex flex-col text-left gap-1">
            <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">{customer.name}</h2>
            <span className="text-sm font-bold text-[#454656]">{customer.email} - {customer.phone}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="border-l-4 border-l-emerald-500 bg-white p-4 rounded-xl shadow-sm border border-[#C5C5D9]/10 flex flex-col text-left">
            <span className="text-[9px] font-bold text-[#454656] uppercase tracking-wider">Fraud Score</span>
            <span className="text-lg font-bold text-[#131B2E] mt-1">{customer.fraudScore}</span>
            <span className="text-[10px] font-bold text-emerald-600 uppercase">{customer.trustLabel}</span>
          </div>
          <button
            onClick={() => onToggleSuspend(customer)}
            disabled={!customer.canSuspend}
            title={customer.canSuspend ? "" : "Backend must return user_id before this action can be used."}
            className={`font-bold text-sm px-6 py-3.5 rounded-full border-none cursor-pointer text-white shadow-md transition-colors ${
              customer.status === "Active" ? "bg-[#BA1A1A] hover:bg-[#A31616]" : "bg-emerald-600 hover:bg-emerald-700"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {customer.status === "Active" ? "Suspend Account" : "Activate Account"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full items-start">
        <div className="lg:col-span-2 flex flex-col gap-8 w-full">
          <div className="bg-white border border-[#C5C5D9]/10 shadow-sm rounded-[24px] overflow-hidden">
            <div className="bg-[#F2F3FF] px-8 py-5 border-b border-[#C5C5D9]/10">
              <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">Recent Receipt Submissions</h3>
            </div>
            <div className="p-4 flex flex-col gap-4">
              {receipts.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="flex justify-between items-center p-4 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-10 h-10 rounded-xl bg-[#E2E7FF] flex items-center justify-center font-bold text-[#001BD2]">
                      #
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-[#131B2E]">{item.merchant}</span>
                      <span className="text-[11px] text-slate-400 font-semibold mt-0.5">{item.date} - ID: {item.id}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col text-right">
                      <span className="font-bold text-[#131B2E]">{item.value}</span>
                      <span className="text-[10px] text-[#001BD2] font-bold uppercase">{item.points}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase ${receiptStatusClass(item.status)}`}>{item.status}</span>
                  </div>
                </div>
              ))}
              {receipts.length === 0 && (
                <div className="p-8 text-center text-sm font-semibold text-slate-400">
                  No recent receipt submissions returned from backend.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#C5C5D9]/10 p-6 rounded-2xl flex flex-col text-left gap-3">
            <div className="flex gap-1"><Star className="w-4 h-4 fill-[#FBBF24] text-[#FBBF24]" /></div>
            <h4 className="font-bold text-sm text-[#131B2E] uppercase tracking-wider">Review Activity</h4>
            <p className="text-sm leading-6 text-[#454656] italic">
              {customer.reviews > 0
                ? `${customer.name} has submitted ${customer.reviews} review${customer.reviews === 1 ? "" : "s"} for this brand.`
                : "No review detail returned from backend yet."}
            </p>
          </div>
        </div>

        <div className="bg-[#F2F3FF] p-6 rounded-[24px] flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-[#C5C5D9]/10 pb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#001BD2]"></div>
            <span className="text-[11px] font-bold text-[#131B2E] tracking-[1.2px] uppercase">Customer Insights</span>
          </div>

          <div className="flex flex-col gap-4 text-left text-sm text-[#454656]">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl">
              <span className="font-bold text-[#131B2E]">Member Since</span>
              <span className="font-semibold">{customer.memberSince}</span>
            </div>
            <div className="flex justify-between items-center bg-white p-4 rounded-xl">
              <span className="font-bold text-[#131B2E]">Total Rewards</span>
              <span className="font-semibold text-[#001BD2]">{customer.rewards}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl flex flex-col gap-4">
            <div className="flex justify-between items-end h-20 px-2 gap-1.5">
              {activityBars.map((val, idx) => (
                <div key={idx} className="flex-1 bg-[#001BD2] rounded-t-[2px]" style={{ height: `${val}%`, opacity: idx === 5 ? 1 : 0.2 + idx * 0.1 }} />
              ))}
            </div>
            <span className="text-[10px] font-extrabold text-[#454656] tracking-[2px] uppercase text-center">Brand Activity Pulse</span>
          </div>

          <div className="flex flex-col gap-3 text-xs text-left">
            <div className="flex gap-2.5 items-start">
              <div className="w-2 h-2 rounded-full bg-[#001BD2] mt-1 flex-shrink-0"></div>
              <div><span className="font-bold text-[#131B2E]">Claims: </span>{customer.claims} submitted for this brand</div>
            </div>
            <div className="flex gap-2.5 items-start">
              <div className="w-2 h-2 rounded-full bg-[#006273] mt-1 flex-shrink-0"></div>
              <div><span className="font-bold text-[#131B2E]">Reviews: </span>{customer.reviews} submitted for this brand</div>
            </div>
            <div className="flex gap-2.5 items-start">
              <div className="w-2 h-2 rounded-full bg-[#BA1A1A] mt-1 flex-shrink-0"></div>
              <div><span className="font-bold text-[#131B2E]">Status: </span>{customer.status}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
