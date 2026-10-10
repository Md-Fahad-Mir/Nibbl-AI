"use client";

import { useEffect, useState } from "react";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

/** Master "Meta Pixel Tracking": the brand turns tracking on or off per
 *  campaign, using only the validated Pixel ID saved in Settings. */
export default function MetaPixelToggle({ campaign }: { campaign: ApiRecord }) {
  const brandId = useBrandApiStore((s) => s.selectedBrandId);
  const refreshCampaigns = useBrandApiStore((s) => s.refreshCampaigns);
  const [validated, setValidated] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const enabled = Boolean(campaign.meta_pixel_enabled);

  useEffect(() => {
    if (!brandId) return;
    let live = true;
    apiClient
      .request<ApiRecord>(backendApi.brand.brandTracking(brandId))
      .then((data) => live && setValidated(Boolean(data.meta_pixel_validated)))
      .catch(() => live && setValidated(false));
    return () => {
      live = false;
    };
  }, [brandId]);

  const toggle = async () => {
    if (!brandId) return;
    setBusy(true);
    setError("");
    try {
      await apiClient.request(backendApi.brand.campaignTracking(brandId, String(campaign.id)), {
        body: { meta_pixel_enabled: !enabled },
      });
      await refreshCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update tracking.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-jakarta text-base font-bold text-[#131B2E]">Meta Pixel tracking</h2>
        <button type="button" role="switch" aria-checked={enabled} disabled={busy || (!enabled && !validated)}
          onClick={() => void toggle()}
          className={`w-11 h-6 rounded-full relative transition-colors disabled:opacity-50 cursor-pointer ${
            enabled ? "bg-[#001BD2]" : "bg-slate-300"
          }`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
      <p className="text-sm text-[#454656]">
        {validated === false && !enabled
          ? "Add and validate your Meta Pixel ID in Settings → Tracking to turn this on."
          : enabled
            ? "Campaign View, Claim and Approved Redemption events are sent to your Meta Pixel."
            : "Tracking is off for this campaign."}
      </p>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </section>
  );
}
