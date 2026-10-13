"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { ApiRecord, API_BASE_URL, apiClient, backendApi, tokenStorage } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatMoney } from "../../utils/backendMappers";
import Pager, { usePaged } from "@/components/shared/Pager";

const COLUMNS = [
  ["rebate_rewards", "Rebate rewards"],
  ["review_rewards", "Review rewards"],
  ["fees", "Fees"],
  ["plan_charges", "Plan charges"],
  ["credits_applied", "Credits applied"],
  ["total_cash_spent", "Total cash spent"],
] as const;

const weekLabel = (start: unknown, end: unknown) => {
  const fmt = (value: unknown) =>
    new Date(`${String(value)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
};

export const downloadCsv = async (path: string, filename: string) => {
  const token = tokenStorage.getAccess();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Download failed.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/** Master Wallet §5: one summarized row per week, each downloadable. */
export default function WeeklyStatements() {
  const selectedBrandId = useBrandApiStore((state) => state.selectedBrandId);
  const [weeks, setWeeks] = useState<ApiRecord[] | null>(null);
  const weeksPage = usePaged(weeks ?? []);
  const [error, setError] = useState("");
  // Master: the detailed ledger (every deposit, reward, fee, credit, release,
  // subscription charge, adjustment and refund) for a chosen date range.
  const [ledgerFrom, setLedgerFrom] = useState("");
  const [ledgerTo, setLedgerTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const downloadLedger = async () => {
    if (!selectedBrandId || exporting) return;
    setExporting(true);
    setError("");
    const query = new URLSearchParams(
      Object.entries({ from: ledgerFrom, to: ledgerTo }).filter(([, value]) => value)
    ).toString();
    try {
      await downloadCsv(
        `/brands/${selectedBrandId}/wallet/transactions/export/${query ? `?${query}` : ""}`,
        "wallet-ledger.csv"
      );
    } catch {
      setError("Could not download the ledger.");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!selectedBrandId) return;
    let live = true;
    apiClient
      .request<ApiRecord[]>(backendApi.brand.weeklyStatements(selectedBrandId), { query: { weeks: 12 } })
      .then((rows) => live && setWeeks(rows))
      .catch((err) => live && setError(err instanceof Error ? err.message : "Could not load statements."));
    return () => {
      live = false;
    };
  }, [selectedBrandId]);

  const download = (week: ApiRecord) =>
    downloadCsv(
      `/brands/${selectedBrandId}/wallet/statements/${String(week.week_start)}/export/`,
      `statement-${String(week.week_start)}.csv`
    ).catch(() => setError("Could not download the statement."));

  return (
    <div className="bg-white border border-[#EAEDFF] rounded-2xl p-6 flex flex-col gap-4 w-full font-manrope">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-jakarta font-bold text-xl text-[#001BD2]">Weekly Statements</h3>
          <p className="text-xs text-[#454656] mt-1">
            Total cash spent is your cost after promotional credits. Deposits and refunds aren&apos;t counted as spending.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input type="date" value={ledgerFrom} onChange={(e) => setLedgerFrom(e.target.value)} aria-label="Ledger from"
            className="h-9 px-2 border border-[#C5C5D9]/40 rounded-lg text-[#131B2E]" />
          <span className="text-[#94A3B8]">–</span>
          <input type="date" value={ledgerTo} onChange={(e) => setLedgerTo(e.target.value)} aria-label="Ledger to"
            className="h-9 px-2 border border-[#C5C5D9]/40 rounded-lg text-[#131B2E]" />
          <button type="button" onClick={() => void downloadLedger()} disabled={exporting}
            className="h-9 px-4 rounded-lg border border-[#001BD2] text-[#001BD2] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
            <Download className="w-4 h-4" /> {exporting ? "Preparing…" : "Download Detailed Ledger"}
          </button>
        </div>
      </div>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-[#454656]/60 border-b border-[#F1F2FA]">
              <th className="py-3 pr-4">Week</th>
              {COLUMNS.map(([key, label]) => (
                <th key={key} className="py-3 pr-4 text-right">{label}</th>
              ))}
              <th className="py-3 text-right">Statement</th>
            </tr>
          </thead>
          <tbody>
            {weeksPage.items.map((week) => (
              <tr key={String(week.week_start)} className="border-b border-[#F8F9FF] text-[#131B2E]">
                <td className="py-3 pr-4 font-semibold whitespace-nowrap">
                  {weekLabel(week.week_start, week.week_end)}
                  {Boolean(week.in_progress) && <span className="ml-2 text-[10px] text-[#001BD2]">This week</span>}
                </td>
                {COLUMNS.map(([key]) => (
                  <td key={key} className={`py-3 pr-4 text-right ${key === "total_cash_spent" ? "font-bold" : ""}`}>
                    {formatMoney(week[key])}
                  </td>
                ))}
                <td className="py-3 text-right">
                  <button onClick={() => void download(week)} aria-label="Download statement"
                    className="h-7 px-3 rounded-md border border-[#001BD2]/60 text-[#001BD2] text-[11px] font-bold hover:bg-[#F2F3FF] cursor-pointer">
                    Download
                  </button>
                </td>
              </tr>
            ))}
            {weeks && weeks.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="py-8 text-center text-slate-400 font-semibold">
                  No statements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager paged={weeksPage} noun="weeks" />
      <p className="text-[11px] text-[#64748B]">
        Weekly statements summarize spending. The detailed ledger contains every deposit, reward, fee, credit, release,
        subscription charge, adjustment and refund.
      </p>
    </div>
  );
}
