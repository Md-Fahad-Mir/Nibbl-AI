"use client";

import { Info } from "lucide-react";

// Master Customers: "Coming-Soon Integrations — these are integrations, not KPIs."
const INTEGRATIONS = [
  { name: "klaviyo", style: "font-serif text-2xl font-bold text-[#131B2E]", detail: "Sync opted-in contacts and reminder events" },
  { name: "Postscript", style: "rounded-lg bg-[#5B2BE0] px-3 py-1 text-base font-extrabold text-white", detail: "Sync SMS consent and reminder events" },
  { name: "shopify", style: "text-2xl font-extrabold italic text-[#5E8E3E]", detail: "Match customers and verified purchase activity" },
];

export default function ComingSoonIntegrations() {
  return (
    <section className="bg-white border border-[#EAEDFF] rounded-2xl p-6 flex flex-col gap-4 w-full font-manrope">
      <h3 className="font-jakarta font-bold text-xl text-[#001BD2]">Customer Integrations — Coming Soon</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {INTEGRATIONS.map((item) => (
          <div key={item.name} className="border border-[#EAEDFF] rounded-xl p-5 flex items-center gap-4">
            <span className={item.style}>{item.name}</span>
            <span className="text-sm text-[#454656]">{item.detail}</span>
          </div>
        ))}
      </div>
      <p className="flex items-center gap-2 text-xs text-[#64748B]">
        <Info className="w-4 h-4 text-[#001BD2]" /> API connections will be available in a future release.
      </p>
    </section>
  );
}
