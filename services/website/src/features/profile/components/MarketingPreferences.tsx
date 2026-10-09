"use client";

import { useEffect, useState } from "react";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";

/** Email + SMS marketing consents (NibblAI and each brand) with withdrawal
 *  (Master: opting out keeps history; the brand sees "Opted Out"). */
export default function MarketingPreferences() {
  const [consents, setConsents] = useState<ApiRecord[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    nibblApi
      .marketingConsents()
      .then((list) => !cancelled && setConsents(list))
      .catch(() => !cancelled && setConsents([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const withdraw = async (brand: string | null) => {
    const key = brand ?? "nibbl";
    setBusy(key);
    setError("");
    try {
      await nibblApi.withdrawConsent(brand);
      setConsents((list) =>
        (list ?? []).map((c) => ((c.brand ?? null) === brand ? { ...c, opted_in: false } : c))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your preference.");
    } finally {
      setBusy(null);
    }
  };

  if (consents === null) return <p className="text-[14px] text-[#575757] p-1.5">Loading…</p>;
  if (!consents.length) {
    return (
      <p className="text-[14px] text-[#575757] p-1.5">
        You haven&apos;t agreed to marketing emails or texts from anyone yet.
      </p>
    );
  }
  return (
    <div className="w-full flex flex-col">
      {consents.map((c) => {
        const brand = (c.brand as string | null) ?? null;
        return (
          <div key={brand ?? "nibbl"} className="flex justify-between items-center p-1.5 gap-3">
            <span className="text-[16px] text-[#575757]">{String(c.brand_name)} — email &amp; SMS</span>
            {c.opted_in ? (
              <button
                onClick={() => void withdraw(brand)}
                disabled={busy !== null}
                className="text-[13px] font-medium text-[#E65353] underline disabled:opacity-50 cursor-pointer"
              >
                {busy === (brand ?? "nibbl") ? "Saving…" : "Opt out"}
              </button>
            ) : (
              <span className="text-[13px] text-[#9A9A9A]">Opted out</span>
            )}
          </div>
        );
      })}
      {error && <p className="text-[13px] text-[#E65353] p-1.5">{error}</p>}
    </div>
  );
}
