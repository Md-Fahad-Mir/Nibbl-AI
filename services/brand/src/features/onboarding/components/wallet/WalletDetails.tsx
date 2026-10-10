"use client";

import { useState } from "react";
import { ArrowUpRight, ArrowDownLeft, Calendar, Download } from "lucide-react";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { downloadCsv } from "./WeeklyStatements";
import { formatDate, formatMoney, formatTime, titleCase, toNumber } from "../../utils/backendMappers";

export default function WalletDetails() {
  const selectedBrandId = useBrandApiStore((state) => state.selectedBrandId);
  const [exporting, setExporting] = useState(false);

  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");

  const handleExportLedger = async () => {
    if (!selectedBrandId || exporting) return;
    setExporting(true);
    const query = new URLSearchParams(
      Object.entries({ from: exportFrom, to: exportTo }).filter(([, value]) => value)
    ).toString();
    try {
      await downloadCsv(
        `/brands/${selectedBrandId}/wallet/transactions/export/${query ? `?${query}` : ""}`,
        "wallet-ledger.csv"
      );
    } catch {
      // Non-fatal: the ledger stays on screen if the export can't be fetched.
    } finally {
      setExporting(false);
    }
  };
  const [activePage, setActivePage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [statusFilter, setStatusFilter] = useState("Status");
  const wallet = useBrandApiStore((state) => state.wallet);
  const walletTransactions = useBrandApiStore((state) => state.walletTransactions);

  const allTransactions = walletTransactions.map((tx) => {
    const signed = toNumber(tx.signed_amount ?? tx.amount);
    return {
      id: String(tx.id ?? tx.created_at),
      date: formatDate(tx.created_at),
      time: formatTime(tx.created_at),
      label: String(tx.description ?? tx.category ?? "Ledger entry"),
      type: signed >= 0 ? "Deposits" : "Withdrawals",
      amount: formatMoney(signed),
      method: titleCase(tx.reference_type ?? "wallet"),
      badge: String(tx.category ?? "").toUpperCase(),
      status: "Succeeded",
      isPos: signed >= 0,
    };
  });

  const filteredTx = allTransactions.filter((tx) => {
    const matchesType = typeFilter === "All Types" || tx.type === typeFilter;
    const matchesStatus = statusFilter === "Status" || tx.status === statusFilter;
    return matchesType && matchesStatus;
  });
  const itemsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(filteredTx.length / itemsPerPage));
  const currentPage = Math.min(activePage, totalPages);
  const pageStart = (currentPage - 1) * itemsPerPage;
  const paginatedTx = filteredTx.slice(pageStart, pageStart + itemsPerPage);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="flex flex-col gap-8 w-full text-left font-manrope">
      <div className="flex flex-row flex-wrap items-center gap-3 w-full bg-[#F2F3FF] p-6 rounded-[24px]">
        <span className="font-jakarta font-bold text-sm text-[#131B2E] mr-auto">
          Transaction History
        </span>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setActivePage(1); }}
          className="bg-white px-4 py-2 border-none rounded-full text-xs font-bold text-[#131B2E] shadow-sm outline-none cursor-pointer"
        >
          <option>All Types</option>
          <option>Deposits</option>
          <option>Withdrawals</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setActivePage(1); }}
          className="bg-white px-4 py-2 border-none rounded-full text-xs font-bold text-[#131B2E] shadow-sm outline-none cursor-pointer"
        >
          <option>Status</option>
          <option>Succeeded</option>
        </select>
        <div className="bg-white px-4 py-1.5 rounded-full flex items-center gap-2 shadow-sm text-xs font-bold text-[#131B2E]">
          <Calendar className="w-3.5 h-3.5 text-[#001BD2]" />
          <span>Export</span>
          <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)}
            aria-label="Export from" className="bg-transparent outline-none text-xs" />
          <span>–</span>
          <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)}
            aria-label="Export to" className="bg-transparent outline-none text-xs" />
        </div>
        <button
          type="button"
          onClick={handleExportLedger}
          disabled={exporting}
          className="bg-[#001BD2] hover:bg-blue-700 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-sm text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{exporting ? "Exporting…" : "Export CSV"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full items-stretch">
        <div className="bg-white border border-[#C5C5D9]/10 shadow-sm rounded-2xl p-6 flex flex-col text-left">
          <span className="text-xs font-bold text-[#454656] uppercase tracking-wider">Total Balance</span>
          <h3 className="font-jakarta font-extrabold text-2xl text-[#131B2E] mt-3">
            {formatMoney(wallet?.balance)}
          </h3>
        </div>
        <div className="bg-white border border-[#C5C5D9]/10 shadow-sm rounded-2xl p-6 flex flex-col text-left">
          <span className="text-xs font-bold text-[#454656] uppercase tracking-wider">Held Funds</span>
          <h3 className="font-jakarta font-extrabold text-2xl text-[#131B2E] mt-3">
            {formatMoney(wallet?.held)}
          </h3>
          <span className="text-[10px] text-[#454656] mt-1 font-semibold">reserved for active claims</span>
        </div>
        <div className="bg-gradient-to-br from-[#001BD2] to-[#2D3FEA] text-white rounded-2xl p-6 shadow-md flex justify-between items-center relative overflow-hidden min-h-[100px]">
          <div className="flex flex-col text-left">
            <span className="text-xs font-medium text-white/80 uppercase tracking-wider">Available</span>
            <h3 className="font-jakarta font-extrabold text-2xl text-white mt-1">
              {formatMoney(wallet?.available)}
            </h3>
          </div>
          <span className="text-[10px] font-bold text-white/80 bg-white/20 px-2.5 py-1 rounded-[6px] text-right">
            {String(wallet?.currency ?? "USD")}
          </span>
        </div>
      </div>

      <div className="w-full bg-white border border-[#C5C5D9]/10 shadow-sm rounded-2xl overflow-hidden flex flex-col">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#C5C5D9]/10 bg-[#FAF8FF]">
                <th className="p-4 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Date</th>
                <th className="p-4 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Type</th>
                <th className="p-4 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Amount</th>
                <th className="p-4 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Method</th>
                <th className="p-4 text-left text-[11px] font-bold tracking-wider text-[#454656] uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                    No transactions match the active filters.
                  </td>
                </tr>
              ) : (
                paginatedTx.map((tx) => (
                  <tr key={tx.id} className="border-b border-[#C5C5D9]/10 hover:bg-[#F2F3FF]/30 text-sm text-[#454656] transition-colors">
                    <td className="p-4 text-left flex flex-col gap-0.5">
                      <span className="font-bold text-[#131B2E]">{tx.date}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{tx.time}</span>
                    </td>
                    <td className="p-4 text-left">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#E2E7FF] flex items-center justify-center text-[#001BD2]">
                          {tx.isPos ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <span className="font-bold text-[#131B2E]">{tx.label}</span>
                      </div>
                    </td>
                    <td className={`p-4 text-left font-bold ${tx.isPos ? "text-emerald-600" : "text-[#131B2E]"}`}>{tx.amount}</td>
                    <td className="p-4 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{tx.method}</span>
                        {tx.badge && <span className="bg-[#E2E7FF] text-[#131B2E] text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase">{tx.badge}</span>}
                      </div>
                    </td>
                    <td className="p-4 text-left">
                      <span className="font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider bg-emerald-100 text-emerald-700">
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-[#FAF8FF] px-6 py-4 border-t border-[#C5C5D9]/10 flex flex-wrap justify-between items-center gap-4">
          <span className="text-xs font-semibold text-[#454656]">
            Showing {paginatedTx.length ? pageStart + 1 : 0}-
            {Math.min(pageStart + paginatedTx.length, filteredTx.length)} of {filteredTx.length} transactions
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage === 1}
              onClick={() => setActivePage((value) => Math.max(1, value - 1))}
              className="w-8 h-8 rounded-lg bg-[#FAF8FF] hover:bg-slate-100 text-slate-400 border-none cursor-pointer flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
            >
              &lt;
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setActivePage(pageNumber)}
                className={`w-8 h-8 rounded-lg border-none cursor-pointer flex items-center justify-center font-bold text-xs ${
                  currentPage === pageNumber
                    ? "bg-[#001BD2] text-white"
                    : "bg-[#FAF8FF] hover:bg-slate-100 text-slate-700"
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setActivePage((value) => Math.min(totalPages, value + 1))}
              className="w-8 h-8 rounded-lg bg-[#FAF8FF] hover:bg-slate-100 text-slate-700 border-none cursor-pointer flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
