"use client";

import { Info, MessageCircle } from "lucide-react";

const SUPPORT_EMAIL = "support@joinnibbl.com";

/** Master Settings §6 — Account, Support & Integrations. Only the Owner can
 *  request account closure, through Nibbl Support. The brand's own Klaviyo
 *  integration is a future Scale feature (Nibbl's system Klaviyo is separate). */
export default function AccountSupportTab() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="bg-white border border-[#C5C5D9]/10 rounded-[20px] p-6 shadow-sm flex flex-col gap-4">
        <div>
          <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">Account & Support</h3>
          <p className="text-xs text-[#64748B] mt-1">Get help or manage your account.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <MessageCircle className="w-8 h-8 text-[#001BD2]" />
          <div className="flex-1 min-w-[180px]">
            <p className="text-sm font-bold text-[#131B2E]">Need help?</p>
            <p className="text-xs text-[#64748B]">Our team is here to help with campaigns, redemptions, or account questions.</p>
          </div>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="h-10 px-5 rounded-full bg-[#001BD2] text-white text-sm font-bold flex items-center"
          >
            Contact Nibbl Support
          </a>
        </div>
        <div className="flex gap-2 rounded-xl bg-[#F2F3FF] p-3 text-xs text-[#454656]">
          <Info className="w-4 h-4 text-[#001BD2] flex-shrink-0" />
          <span>
            <b>Only the Owner can request account closure.</b> To close your account, the Owner contacts Nibbl
            Support.
          </span>
        </div>
      </section>

      <section className="bg-white border border-[#C5C5D9]/10 rounded-[20px] p-6 shadow-sm flex flex-col gap-4">
        <div>
          <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">Integrations</h3>
          <p className="text-xs text-[#64748B] mt-1">Connect your brand tools to streamline your workflow.</p>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-[#EAEDFF] p-4">
          <span className="w-10 h-10 rounded-xl bg-[#131B2E] text-white font-extrabold flex items-center justify-center">K</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#131B2E] flex flex-wrap items-center gap-2">
              Klaviyo
              <span className="text-[10px] font-bold text-[#454656] bg-[#F2F3FF] rounded-full px-2 py-0.5">
                Coming Soon · Scale
              </span>
            </p>
            <p className="text-xs text-[#64748B]">Connect your brand account for opted-in customer sync.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
