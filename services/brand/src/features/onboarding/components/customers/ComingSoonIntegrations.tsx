"use client";

// Master Customers: "Coming-Soon Integrations — these are integrations, not KPIs."
const INTEGRATIONS = [
  { name: "Klaviyo", detail: "Consented contacts and reminder events." },
  { name: "Postscript", detail: "SMS consent and reminder events." },
  { name: "Shopify", detail: "Customer matching and verified-purchase activity." },
];

export default function ComingSoonIntegrations() {
  return (
    <section className="flex flex-col gap-3 w-full font-manrope">
      <h3 className="font-jakarta font-bold text-base text-[#131B2E]">Integrations</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {INTEGRATIONS.map((item) => (
          <div key={item.name} className="bg-[#F8F9FF] border border-[#EAEDFF] rounded-[20px] p-5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-jakarta font-bold text-sm text-[#131B2E]">{item.name}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Coming soon</span>
            </div>
            <span className="text-xs text-[#454656]">{item.detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
