"use client";

import { useEffect, useState } from "react";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatDate } from "../../utils/backendMappers";

/** Master Settings §4 "Tracking & Attribution": one Meta Pixel ID per brand,
 *  validated before use. Google Tag and TikTok Pixel are Coming Soon. */
export default function TrackingTab() {
  const brandId = useBrandApiStore((s) => s.selectedBrandId);
  const [tracking, setTracking] = useState<ApiRecord | null>(null);
  const [pixelId, setPixelId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (!brandId) return;
    let live = true;
    apiClient
      .request<ApiRecord>(backendApi.brand.brandTracking(brandId))
      .then((data) => {
        if (!live) return;
        setTracking(data);
        setPixelId(String(data.meta_pixel_id ?? ""));
      })
      .catch((err) => live && setError(err instanceof Error ? err.message : "Could not load tracking settings."));
    return () => {
      live = false;
    };
  }, [brandId]);

  const save = async (value: string) => {
    if (!brandId) return;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const data = await apiClient.request<ApiRecord>(backendApi.brand.updateBrandTracking(brandId), {
        body: { meta_pixel_id: value },
      });
      setTracking(data);
      setPixelId(String(data.meta_pixel_id ?? ""));
      setSaved(value ? "Meta Pixel ID validated and saved." : "Meta Pixel removed. Tracking is off for all campaigns.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the Pixel ID.");
    } finally {
      setBusy(false);
    }
  };

  const validated = Boolean(tracking?.meta_pixel_validated);

  return (
    <div className="flex flex-col gap-6 max-w-[760px]">
      <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-jakarta font-bold text-base text-[#131B2E]">Meta Pixel</h3>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
            validated ? "bg-emerald-50 text-[#15803D]" : "bg-slate-100 text-slate-500"
          }`}>
            {validated ? `Validated ${formatDate(String(tracking?.meta_pixel_validated_at ?? ""))}` : "Not connected"}
          </span>
        </div>
        <p className="text-sm text-[#454656]">
          Enter your Meta Pixel ID (the 15–16 digit number from Meta Events Manager). Nibbl sends{" "}
          <b>Campaign View</b>, <b>Claim</b> and <b>Approved Redemption</b> events to it for campaigns where you turn
          tracking on. Scripts and custom tracking code aren&apos;t accepted.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={pixelId}
            onChange={(e) => setPixelId(e.target.value.replace(/[^\d]/g, "").slice(0, 16))}
            inputMode="numeric"
            placeholder="e.g. 123456789012345"
            className="flex-1 min-w-[220px] h-11 px-3 rounded-xl border border-[#E0E3F5] text-sm outline-none focus:border-[#001BD2]"
          />
          <button type="button" disabled={busy || pixelId.length < 15} onClick={() => void save(pixelId)}
            className="h-11 px-5 rounded-full bg-[#001BD2] text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
            {busy ? "Validating…" : "Validate & save"}
          </button>
          {Boolean(tracking?.meta_pixel_id) && (
            <button type="button" disabled={busy} onClick={() => void save("")}
              className="h-11 px-4 rounded-full text-red-600 text-sm font-bold disabled:opacity-50 cursor-pointer">
              Remove
            </button>
          )}
        </div>
        {saved && <p className="text-xs font-semibold text-[#15803D]">{saved}</p>}
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <p className="text-xs text-[#94A3B8]">
          Turn tracking on or off for each campaign from the campaign&apos;s page. Events fire from the shopper&apos;s browser;
          Approved Redemption fires the next time the shopper opens their wallet after approval.
        </p>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {["Google Tag", "TikTok Pixel"].map((name) => (
          <div key={name} className="bg-[#F8F9FF] border border-[#EAEDFF] rounded-[20px] p-5 flex items-center justify-between">
            <span className="font-jakarta font-bold text-sm text-[#131B2E]">{name}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}
