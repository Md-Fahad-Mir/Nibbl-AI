"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";
import { SavedCard, useBrandApiStore } from "@/stores/useBrandApiStore";
import FundWalletModal from "../../wallet/FundWalletModal";
import { formatMoney } from "../../../utils/backendMappers";

/** Ask the backend whether a campaign can be submitted (Master ⑪). */
export async function launchReady(brandId: string, campaignId: string): Promise<boolean> {
  const state = await apiClient.request<ApiRecord>(backendApi.brand.launchReadiness(brandId, campaignId));
  return Boolean(state.ready);
}

/** Master onboarding ⑪ "Fund your campaign before launch": the campaign can't
 *  be submitted until the Wallet covers the 7-day requirement and
 *  auto-replenishment is on. */
export default function LaunchFundingModal({ campaignId, campaignName, onClose, onReady, onOpenWallet }: {
  campaignId: string;
  campaignName: string;
  onClose: () => void;
  onReady: () => Promise<void> | void;
  onOpenWallet?: () => void;
}) {
  const brandId = useBrandApiStore((s) => s.selectedBrandId) ?? "";
  const loadSavedCards = useBrandApiStore((s) => s.loadSavedCards);
  const saveAutoRefill = useBrandApiStore((s) => s.saveAutoRefill);
  const refreshWallet = useBrandApiStore((s) => s.refreshWallet);
  const [state, setState] = useState<ApiRecord | null>(null);
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [card, setCard] = useState("");
  const [amount, setAmount] = useState("");
  const [enable, setEnable] = useState(true);
  const [funding, setFunding] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchReadiness = useCallback(
    () => apiClient.request<ApiRecord>(backendApi.brand.launchReadiness(brandId, campaignId)),
    [brandId, campaignId]
  );
  const load = async () => {
    const next = await fetchReadiness();
    setState(next);
    return next;
  };

  useEffect(() => {
    let live = true;
    const init = ([next, saved]: [ApiRecord, SavedCard[]]) => {
      setState(next);
      setCards(saved);
      setCard(String(next.payment_method_id || saved[0]?.id || ""));
      setAmount(String(Number(next.auto_refill_amount) > 0 ? next.auto_refill_amount : next.recommended_refill));
    };
    Promise.all([fetchReadiness(), loadSavedCards()])
      .then((result) => live && init(result))
      .catch((err) => live && setError(err instanceof Error ? err.message : "Could not load funding."));
    return () => {
      live = false;
    };
  }, [fetchReadiness, loadSavedCards]);

  const finish = async () => {
    // The wallet is credited by Stripe's webhook — re-check for a few seconds.
    for (let i = 0; i < 6; i += 1) {
      await refreshWallet();
      const next = await load();
      if (next.ready) {
        await onReady();
        return;
      }
      if (Number(next.minimum_needed) > 0) await new Promise((r) => setTimeout(r, 2000));
      else break;
    }
    setError("Your payment is still processing. Submit again in a moment.");
  };

  const fundAndContinue = async () => {
    if (!card) {
      setError("Add a payment card for auto-replenishment first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveAutoRefill({ enabled: enable, amount: Number(amount).toFixed(2), payment_method_id: card });
      const minimum = Number((await load()).minimum_needed ?? 0);
      if (minimum > 0) setFunding(minimum.toFixed(2));
      else await finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save auto-replenishment.");
    } finally {
      setBusy(false);
    }
  };

  if (funding) {
    return (
      <FundWalletModal amount={funding} onClose={() => {
        setFunding("");
        setBusy(true);
        void finish().finally(() => setBusy(false));
      }} />
    );
  }

  const row = (label: string, value: unknown, strong = false, red = false) => (
    <div className={`flex justify-between ${strong ? "font-extrabold text-[#131B2E]" : "text-[#454656]"}`}>
      <span>{label}</span><span className={red ? "text-red-600" : ""}>{formatMoney(value)}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto bg-white rounded-[24px] p-6 flex flex-col gap-4 font-manrope">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-jakarta text-xl font-extrabold text-[#131B2E]">Fund your campaign before launch</h2>
            <p className="text-sm text-[#454656]">{campaignName} · Rebate campaign</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-[#94A3B8] text-lg cursor-pointer">✕</button>
        </div>
        {!state ? (
          <p className="text-sm text-[#64748B]">{error || "Loading…"}</p>
        ) : (
          <>
            <div className="border border-[#EAEDFF] rounded-2xl p-4 flex flex-col gap-2 text-sm">
              {row("Estimated 7-day funding requirement", state.seven_day_requirement)}
              {row("Current Wallet balance", state.available, false, Number(state.available) < Number(state.seven_day_requirement))}
              <div className="border-t border-[#F1F2FA] pt-2">{row("Minimum needed to launch", state.minimum_needed, true)}</div>
            </div>
            <div className="border border-[#EAEDFF] rounded-2xl p-4 flex flex-col gap-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#131B2E]">Auto-replenishment funding</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">Nibbl recommendation</span>
              </div>
              <label className="flex flex-col gap-1 text-xs text-[#454656]">
                Auto-replenishment amount
                <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="h-11 px-3 rounded-xl border border-[#E0E3F5] text-sm text-[#131B2E] outline-none focus:border-[#001BD2]" />
              </label>
              <p className="text-xs text-[#64748B]">Refill when available cash reaches 25% of the 7-day requirement.</p>
              <label className="flex flex-col gap-1 text-xs text-[#454656]">
                Payment method
                {cards.length ? (
                  <select value={card} onChange={(e) => setCard(e.target.value)}
                    className="h-11 px-3 rounded-xl border border-[#E0E3F5] text-sm text-[#131B2E] outline-none">
                    {cards.map((c) => <option key={c.id} value={c.id}>{(c.brand ?? "Card").toUpperCase()} ending {c.last4}</option>)}
                  </select>
                ) : (
                  <span className="text-red-600">No saved card yet. {onOpenWallet && (
                    <button type="button" onClick={onOpenWallet} className="underline font-bold cursor-pointer">Add one in Wallet</button>
                  )}</span>
                )}
              </label>
              <label className="flex items-center gap-2 text-sm text-[#131B2E]">
                <input type="checkbox" checked={enable} onChange={(e) => setEnable(e.target.checked)} className="accent-[#001BD2]" />
                Enable auto-replenishment — automatically add {formatMoney(amount || 0)} when the balance reaches 25%.
              </label>
            </div>
            <ul className="text-xs text-[#454656] bg-[#F8F9FF] rounded-xl p-3 list-disc pl-6 flex flex-col gap-1">
              <li>Shopper rewards are deducted as claims and reviews are approved.</li>
              <li>If the Wallet reaches $0, all active campaigns pause until funds are added.</li>
              <li>Unused available funds are refundable, minus pending claims and review obligations.</li>
            </ul>
            {error && <p className="text-xs font-bold text-red-600">{error}</p>}
            <button type="button" disabled={busy || !enable} onClick={() => void fundAndContinue()}
              className="h-12 rounded-full bg-[#001BD2] text-white font-bold text-sm disabled:opacity-50 cursor-pointer">
              {busy ? "Working…" : "Fund Wallet & Continue"}
            </button>
            <button type="button" onClick={onClose}
              className="h-12 rounded-full border border-[#001BD2]/40 text-[#001BD2] font-bold text-sm cursor-pointer">
              Save Campaign as Draft
            </button>
            <p className="text-[11px] text-center text-[#64748B]">
              🔒 This campaign will not launch until the Wallet requirement is met and auto-replenishment is enabled.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
