"use client";

import { useState } from "react";
import { customerInitials } from "../../utils/backendMappers";

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

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
  brandClaims: number;
  openClaims: number;
  cooldownDaysLeft: number | null;
  siteActivity: { claims: number; completionRate: number | null; reviews: number };
  // Brand marketing consent (Master): badge + date.
  consent: "Opted In" | "Opted Out" | "No consent";
  consentDate: string;
  openClaim: boolean;
  inCooldown: boolean;
  lastActivityAt: string | null;
  lastActivity: string;
  avatar: string;
  canSuspend: boolean;
}

interface CustomerLedgerProps {
  customers: CustomerData[];
  onSelectCustomer: (c: CustomerData) => void;
}

export default function CustomerLedger({ customers, onSelectCustomer }: CustomerLedgerProps) {
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
          <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">Customers</h3>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#C5C5D9]/10 bg-[#FAF8FF]">
              <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Customer</th>
              <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Contact</th>
              <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Brand Activity</th>
              <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Site Activity</th>
              <th className="p-5 text-center text-[11px] font-bold tracking-wider text-[#454656] uppercase">Open Claims</th>
              <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Cooldowns</th>
              <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Last Active</th>
              <th className="p-5 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Status</th>
              <th className="p-5 text-right text-[11px] font-bold tracking-wider text-[#454656] uppercase">Action</th>
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
                <td className="p-5 text-left text-xs">
                  <div className="font-bold text-[#131B2E]">{plural(c.brandClaims, "claim")}</div>
                  <div>{plural(c.claims, "rebate")} · {plural(c.reviews, "review")}</div>
                </td>
                <td className="p-5 text-left text-xs">
                  <div className="font-bold text-[#131B2E]">{c.siteActivity.claims} total {c.siteActivity.claims === 1 ? "claim" : "claims"}</div>
                  <div>
                    {c.siteActivity.completionRate == null ? "—" : `${c.siteActivity.completionRate}%`} completion ·{" "}
                    {plural(c.siteActivity.reviews, "review")}
                  </div>
                </td>
                <td className="p-5 text-center">
                  {c.openClaims > 0 ? (
                    <span className="text-xs font-bold text-red-600 bg-red-50 rounded-full px-3 py-1 whitespace-nowrap">{c.openClaims} open</span>
                  ) : (
                    <span className="text-xs font-semibold text-[#64748B] bg-[#EEF0FF] rounded-full px-3 py-1">None</span>
                  )}
                </td>
                <td className="p-5 text-left text-xs">
                  {c.cooldownDaysLeft == null ? (
                    <span className="text-slate-400">None</span>
                  ) : (
                    <span className="font-semibold text-[#131B2E] whitespace-nowrap">{c.cooldownDaysLeft} days left</span>
                  )}
                </td>
                <td className="p-5 text-left font-medium">{c.lastActivity}</td>
                <td className="p-5 text-left">
                  <span className={`font-bold text-xs px-3 py-1 rounded-full inline-flex items-center gap-1.5 ${
                    c.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${c.status === "Active" ? "bg-emerald-500" : "bg-red-500"}`} />
                    {c.status === "Active" ? "Active" : "Banned"}
                  </span>
                </td>
                <td className="p-5 text-right">
                  <button
                    onClick={() => onSelectCustomer(c)}
                    className="border border-[#001BD2] bg-white hover:bg-[#F2F3FF] text-[#001BD2] font-bold text-xs px-5 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {paginatedCustomers.length === 0 && (
              <tr>
                <td colSpan={9} className="p-10 text-center text-sm font-semibold text-slate-400">
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
