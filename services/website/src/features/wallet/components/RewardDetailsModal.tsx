"use client";

import { ApiRecord } from "@/lib/api/backendApi";
import { STATUS_BADGE, money, shortDate } from "./WalletActivity";
import { Check, X } from "lucide-react";

const DETAIL_LABELS: [string, string][] = [
  ["reward_type", "Reward type"],
  ["campaign", "Campaign"],
  ["send_to", "Send to"],
  ["receipt_date", "Receipt date"],
  ["reference", "Reference"],
];

/** Master "Reward Details": status, timeline and the reward's details. */
export default function RewardDetailsModal({ item, onClose }: { item: ApiRecord; onClose: () => void }) {
  const badge = STATUS_BADGE[String(item.status)];
  const timeline = (Array.isArray(item.timeline) ? item.timeline : []) as ApiRecord[];
  const details = (item.details ?? {}) as ApiRecord;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-[440px] bg-white rounded-[16px] p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start">
          <h3 className="text-[18px] font-semibold text-[#1F1D1D]">
            {item.type === "withdrawal" ? "Withdrawal details" : "Reward details"}
          </h3>
          <button onClick={onClose} aria-label="Close" className="text-[#8A8A8A] cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-3">
          {Boolean(item.image) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={String(item.image)} alt="" className="w-16 h-16 rounded-[8px] object-cover" />
          )}
          <div className="flex flex-col gap-1">
            {Boolean(item.brand) && <span className="text-[11px] font-semibold uppercase text-[#8A8A8A]">{String(item.brand)}</span>}
            <span className="text-[15px] font-medium text-[#1F1D1D]">{String(item.title)}</span>
            <span className="text-[20px] font-semibold text-[#1F1D1D]">{money(item.amount)}</span>
            {badge && <span className={`self-start text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>}
          </div>
        </div>

        <ol className="flex flex-col gap-3 border border-gray-100 rounded-[10px] p-4">
          {timeline.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className={`mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] ${
                step.done ? "bg-[#3E3EDF] text-white" : step.current ? "border-2 border-[#3E3EDF]" : "border-2 border-gray-200"
              }`}>
                {step.done ? <Check className="w-3 h-3" strokeWidth={3} /> : null}
              </span>
              <div className="flex flex-col">
                <span className={`text-[14px] font-medium ${step.done || step.current ? "text-[#1F1D1D]" : "text-[#8A8A8A]"}`}>
                  {String(step.label)}
                </span>
                {Boolean(step.at) && <span className="text-[12px] text-[#8A8A8A]">{shortDate(step.at)}</span>}
                {Boolean(step.note) && <span className="text-[12px] text-[#8A8A8A]">{String(step.note)}</span>}
              </div>
            </li>
          ))}
        </ol>

        <dl className="flex flex-col gap-1.5 text-[13px]">
          {DETAIL_LABELS.filter(([key]) => details[key]).map(([key, label]) => (
            <div key={key} className="flex justify-between gap-3">
              <dt className="text-[#8A8A8A]">{label}</dt>
              <dd className="text-[#1F1D1D] text-right">{key === "receipt_date" ? shortDate(details[key]) : String(details[key])}</dd>
            </div>
          ))}
        </dl>

        {item.status === "pending" && (
          <p className="text-[12px] text-[#575757] bg-[#F6F6FB] rounded-[8px] p-3">This reward cannot be withdrawn until approved.</p>
        )}
      </div>
    </div>
  );
}
