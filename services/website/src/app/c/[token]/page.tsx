"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { nibblApi } from "@/lib/api/backendApi";

/** Campaign URL / QR entry (www.joinnibbl.com/c/<token>): resolve the token
 *  to its campaign and open that offer in the app. */
export default function CampaignLinkPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    nibblApi
      .offerByUrl(token)
      .then((offer) => live && router.replace(`/?campaign=${encodeURIComponent(String(offer.campaign_id))}`))
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [token, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-white">
      {missing ? (
        <>
          <p className="text-[18px] font-medium text-[#2D2D2D]">This offer isn&apos;t available right now.</p>
          <button onClick={() => router.replace("/")}
            className="h-[48px] px-6 rounded-[8px] bg-[#3E3EDF] text-white text-[16px] font-medium cursor-pointer">
            See other offers
          </button>
        </>
      ) : (
        <p className="text-[16px] text-[#575757]">Opening your offer…</p>
      )}
    </main>
  );
}
