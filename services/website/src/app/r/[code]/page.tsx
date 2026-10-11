"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { rememberReferral } from "@/lib/referral";

/** Master referral link (joinnibbl.com/r/CODE, optionally ?deal=<campaign>):
 *  remember the code for sign-up, then open the deal or the home page. */
export default function ReferralLinkPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  useEffect(() => {
    const deal = new URLSearchParams(window.location.search).get("deal");
    rememberReferral(String(code ?? ""), deal);
    router.replace(deal ? `/?campaign=${encodeURIComponent(deal)}` : "/");
  }, [code, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-[16px] text-[#575757]">Opening Nibbl…</p>
    </main>
  );
}
