"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { ApiRecord, API_BASE_URL, apiClient, backendApi, tokenStorage } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatMoney } from "../../utils/backendMappers";

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
  const [error, setError] = useState("");

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
    <div className="bg-white border border-[#C5C5D9]/10 shadow-sm rounded-[24px] p-6 flex flex-col gap-4 w-full">
      <div>
        <h3 className="font-jakarta font-bold text-base text-[#131B2E]">Weekly Statements</h3>
        <p className="text-xs text-[#454656] mt-1">
          Total cash spent is your cost after promotional credits. Deposits and refunds aren&apos;t counted as spending.
        </p>
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
            {(weeks ?? []).map((week) => (
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
                    className="text-[#001BD2] hover:opacity-70 cursor-pointer">
                    <Download className="w-4 h-4 inline" />
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
    </div>
  );
}
