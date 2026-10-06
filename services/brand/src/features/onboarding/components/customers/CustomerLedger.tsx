"use client";

import { useState } from "react";
import { SlidersHorizontal, Download } from "lucide-react";
import { customerInitials } from "../../utils/backendMappers";

export interface CustomerData {
  id: string;
  userId: string;
  name: string;
  memberId: string;
  email: string;
  phone: string;
  claims: number;
  reviews: number;
  rewards: string;
  status: "Active" | "Suspended";
  lastActivity: string;
  avatar: string;
  memberSince: string;
  canSuspend: boolean;
  fraudScore: string;
  trustLabel: string;
  recentReceipts?: {
    merchant: string;
    date: string;
    id: string;
    value: string;
    points: string;
    status: string;
  }[];
}

interface CustomerLedgerProps {
  customers: CustomerData[];
  onSelectCustomer: (c: CustomerData) => void;
  onToggleSuspend: (c: CustomerData) => void;
}

export default function CustomerLedger({ customers, onSelectCustomer, onToggleSuspend }: CustomerLedgerProps) {
  const [activePage, setActivePage] = useState(1);
  const itemsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(customers.length / itemsPerPage));
  const currentPage = Math.min(activePage, totalPages);
  const pageStart = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = customers.slice(pageStart, pageStart + itemsPerPage);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="w-full bg-white border border-[#C5C5D9]/10 shadow-[0px_19px_24px_-4px_rgba(19,27,46,0.05)] rounded-[20px] overflow-hidden flex flex-col font-manrope">
      
      {/* Ledger Header */}
      <div className="bg-[#F2F3FF] px-8 py-5 border-b border-[#C5C5D9]/10 flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">Customer Ledger</h3>
          <span className="bg-[#DFE0FF] text-[#0B22D9] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Live Data
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-lg hover:bg-slate-200 border-none cursor-pointer flex items-center justify-center text-[#454656]">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 rounded-lg hover:bg-slate-200 border-none cursor-pointer flex items-center justify-center text-[#454656]">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#C5C5D9]/10 bg-[#FAF8FF]">
              <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Name</th>
              <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Contact Information</th>
              <th className="p-5 text-center text-[11px] font-bold tracking-wider text-[#454656] uppercase">Claims</th>
              <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Rewards Earned</th>
              <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Status</th>
              <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Last Activity</th>
              <th className="p-5 text-right text-[11px] font-bold tracking-wider text-[#454656] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCustomers.map((c) => (
              <tr key={c.id} className="border-b border-[#C5C5D9]/10 hover:bg-[#F2F3FF]/30 transition-colors text-sm text-[#454656]">
                <td className="p-5 text-left">
                  <div className="flex items-center gap-3">
                    <button onClick={() => onSelectCustomer(c)} className="w-10 h-10 rounded-full border-none cursor-pointer overflow-hidden flex-shrink-0 bg-[#D0E1FB]">
                      {c.avatar ? (
                        <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-xs font-extrabold text-[#001BD2]">
                          {customerInitials(c.name)}
                        </span>
                      )}
                    </button>
                    <div className="flex flex-col text-left">
                      <button onClick={() => onSelectCustomer(c)} className="bg-transparent border-none p-0 text-left font-bold text-[#131B2E] text-sm hover:text-[#001BD2] hover:underline cursor-pointer">
                        {c.name}
                      </button>
                      <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Member ID: {c.memberId}</span>
                    </div>
                  </div>
                </td>
                <td className="p-5 text-left">
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="font-bold text-[#131B2E]">{c.email}</span>
                    <span className="text-[11px] text-[#454656] font-medium">{c.phone}</span>
                  </div>
                </td>
                <td className="p-5 text-center font-bold text-[#131B2E]">{c.claims}</td>
                <td className="p-5 text-left font-bold text-[#001BD2]">{c.rewards}</td>
                <td className="p-5 text-left">
                  <span className={`font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider ${
                    c.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}>
                    {c.status}
                  </span>
                </td>
                <td className="p-5 text-left font-medium">{c.lastActivity}</td>
                <td className="p-5 text-right">
                  <button
                    onClick={() => onToggleSuspend(c)}
                    disabled={!c.canSuspend}
                    title={c.canSuspend ? "" : "Backend must return user_id before this action can be used."}
                    className="bg-[#E2E7FF] hover:bg-[#D0D7FF] text-[#001BD2] font-bold text-xs px-4 py-2 rounded-full transition-colors border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {c.status === "Active" ? "Suspend" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
            {paginatedCustomers.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-sm font-semibold text-slate-400">
                  No customers available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="bg-[#FAF8FF] px-8 py-4 border-t border-[#C5C5D9]/10 flex flex-wrap justify-between items-center gap-4">
        <span className="text-xs font-semibold text-[#454656]">
          Showing {paginatedCustomers.length ? pageStart + 1 : 0} to{" "}
          {Math.min(pageStart + paginatedCustomers.length, customers.length)} of{" "}
          {customers.length} members
        </span>
        <div className="flex items-center gap-1.5">
          <button
            disabled={currentPage === 1}
            onClick={() => setActivePage((value) => Math.max(1, value - 1))}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 cursor-pointer flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
          >
            &lt;
          </button>
          {pageNumbers.map(page => (
            <button
              key={page}
              onClick={() => setActivePage(page)}
              className={`w-8 h-8 rounded-full border-none cursor-pointer flex items-center justify-center font-bold text-xs ${
                activePage === page ? "bg-[#001BD2] text-white shadow-sm" : "bg-white hover:bg-slate-100 border border-slate-200 text-slate-700"
              }`}
            >
              {page}
            </button>
          ))}
          <button
            disabled={currentPage === totalPages}
            onClick={() => setActivePage((value) => Math.min(totalPages, value + 1))}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 cursor-pointer flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
          >
            &gt;
          </button>
        </div>
      </div>

    </div>
  );
}
