"use client";

import { Crown, Info, Lock, type LucideIcon, WalletMinimal } from "lucide-react";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatMoney, toNumber } from "../../utils/backendMappers";
import { SectionTitle } from "./FundingAndSpending";

const Balance = ({
  Icon,
  tone,
  label,
  value,
  note,
  help,
}: {
  Icon: LucideIcon;
  tone: string;
  label: string;
  value: number;
  note: string;
  help: string;
}) => (
  <div className="border border-[#EAEDFF] rounded-xl p-5 flex items-center gap-4">
    <span className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 ${tone}`}>
      <Icon className="w-8 h-8" />
    </span>
    <span className="flex flex-col gap-1 min-w-0">
      <span className="flex items-center gap-1 text-sm font-semibold text-[#001BD2]">
        {label}
        <span title={help} className="cursor-help">
          <Info className="w-3.5 h-3.5 text-[#94A3B8]" />
        </span>
      </span>
      <span className="text-3xl font-extrabold text-[#131B2E]">{formatMoney(value)}</span>
      <span className="text-xs text-[#64748B]">{note}</span>
    </span>
  </div>
);

/** Master Wallet §1 Balances: Available Funds, Reserved Funds and one
 *  combined Promotional Credits balance. */
export default function WalletOverview() {
  const wallet = useBrandApiStore((state) => state.wallet);
  // Available Funds = real money free for new claims (promotional credit
  // never funds rewards).
  const available = toNumber(wallet?.reward_available ?? wallet?.available ?? wallet?.balance ?? 0);

  return (
    <section className="bg-white border border-[#EAEDFF] rounded-2xl p-6 flex flex-col gap-4 font-manrope">
      <SectionTitle title="Balances" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Balance
          Icon={WalletMinimal}
          tone="bg-emerald-50 text-emerald-600"
          label="Available Funds"
          value={available}
          note="Available for new claims and opportunities"
          help="Funds available for new rebate claims and review opportunities."
        />
        <Balance
          Icon={Lock}
          tone="bg-[#F3E8FF] text-[#7C3AED]"
          label="Reserved Funds"
          value={toNumber(wallet?.held)}
          note={`Committed to open claims (${formatMoney(wallet?.reserved_rebates)}) and review opportunities (${formatMoney(wallet?.reserved_reviews)})`}
          help="Funds committed to existing claims and review opportunities."
        />
        <Balance
          Icon={Crown}
          tone="bg-[#EEF0FF] text-[#4F46E5]"
          label="Promotional Credits"
          value={toNumber(wallet?.promotional)}
          note="Applies to eligible Nibbl fees and plan charges. Never funds shopper rewards; non-refundable."
          help="Credits that may pay eligible transaction fees and plan charges."
        />
      </div>
    </section>
  );
}
