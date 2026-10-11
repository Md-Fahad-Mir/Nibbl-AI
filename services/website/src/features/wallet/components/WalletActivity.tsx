"use client";

import { useState } from "react";
import { ApiRecord } from "@/lib/api/backendApi";

const TABS = [
  { value: "all", label: "All" },
  { value: "rebate", label: "Rebates" },
  { value: "review", label: "Reviews" },
  { value: "referral", label: "Referrals" },
  { value: "withdrawal", label: "Withdrawals" },
];

// Master Wallet Activity: Pending / Available / Completed groups.
const GROUPS = [
  { label: "Pending", statuses: ["pending"] },
  { label: "In progress", statuses: ["requested", "processing"] },
  { label: "Available", statuses: ["available"] },
  { label: "Completed", statuses: ["paid", "rejected", "failed"] },
];

export const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending approval", className: "bg-[#FFF4E0] text-[#B26A00]" },
  available: { label: "Available", className: "bg-[#E6F7F0] text-[#00875A]" },
  requested: { label: "Requested", className: "bg-[#EEF0FF] text-[#3E3EDF]" },
  processing: { label: "Processing", className: "bg-[#EEF0FF] text-[#3E3EDF]" },
  paid: { label: "Paid", className: "bg-[#E6F7F0] text-[#00875A]" },
  rejected: { label: "Returned to balance", className: "bg-gray-100 text-[#575757]" },
  failed: { label: "Failed — returned to balance", className: "bg-[#FDECEC] text-[#C0392B]" },
};

export const money = (value: unknown) => {
  const n = Number(value ?? 0);
  return `${n < 0 ? "−" : "+"}$${Math.abs(n).toFixed(2)}`;
};

export const shortDate = (value: unknown) =>
  value ? new Date(String(value)).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

/** Master "Wallet Activity": every wallet transaction with its status. */
export default function WalletActivity({ items, onOpen }: { items: ApiRecord[]; onOpen: (item: ApiRecord) => void }) {
  const [tab, setTab] = useState("all");
  const [showHelp, setShowHelp] = useState(false);
  const visible = items.filter((i) => tab === "all" || i.type === tab);

  return (
    <section className="w-full max-w-[1165px] bg-[#FEFEFE] shadow-[0px_4px_6.5px_rgba(0,0,0,0.12)] rounded-[12px] p-5 sm:p-6 flex flex-col gap-4 border border-gray-100">
      <h2 className="text-[20px] font-semibold text-[#1F1D1D]">Wallet Activity</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`h-9 px-4 rounded-full text-[13px] font-medium whitespace-nowrap cursor-pointer border ${
              tab === t.value ? "bg-[#3E3EDF] text-white border-[#3E3EDF]" : "bg-white text-[#575757] border-gray-200"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 && <p className="py-6 text-center text-[14px] text-[#8A8A8A]">No wallet activity yet.</p>}

      {GROUPS.map((group) => {
        const rows = visible.filter((i) => group.statuses.includes(String(i.status)));
        if (!rows.length) return null;
        return (
          <div key={group.label} className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#575757]">{group.label} ({rows.length})</span>
            {rows.map((item) => {
              const badge = STATUS_BADGE[String(item.status)];
              return (
                <button key={String(item.id)} onClick={() => onOpen(item)}
                  className="w-full flex items-center gap-3 border border-gray-100 rounded-[10px] p-3 text-left hover:bg-gray-50 cursor-pointer">
                  <div className="w-11 h-11 rounded-[8px] bg-[#F2F3FF] overflow-hidden flex items-center justify-center flex-shrink-0 text-[#3E3EDF] font-semibold">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={String(item.image)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      String(item.type).slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-[#1F1D1D] truncate">{String(item.title)}</div>
                    <div className="text-[12px] text-[#8A8A8A]">{shortDate(item.date)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[14px] font-semibold text-[#1F1D1D]">{money(item.amount)}</span>
                    {badge && <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}

      <button onClick={() => setShowHelp((v) => !v)} className="self-start text-[13px] text-[#3E3EDF] cursor-pointer">
        How wallet statuses work
      </button>
      {showHelp && (
        <ul className="text-[13px] text-[#575757] list-disc pl-5 flex flex-col gap-1">
          <li><b>Pending approval</b> — your receipt is being reviewed. It can&apos;t be withdrawn until approved.</li>
          <li><b>Available</b> — approved and ready to withdraw.</li>
          <li><b>Requested / Processing</b> — your withdrawal is on its way to your payout account.</li>
          <li><b>Paid</b> — sent to your payout account.</li>
          <li><b>Returned to balance</b> — a withdrawal wasn&apos;t approved; the full amount went back to your balance.</li>
          <li><b>Failed</b> — PayPal or Venmo couldn&apos;t complete the payment; the full amount went back to your balance.</li>
        </ul>
      )}
    </section>
  );
}
