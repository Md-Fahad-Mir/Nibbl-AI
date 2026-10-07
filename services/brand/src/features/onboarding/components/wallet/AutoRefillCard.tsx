"use client";

import { useEffect, useState } from "react";
import { useBrandApiStore, type SavedCard } from "@/stores/useBrandApiStore";
import SaveCardModal from "./SaveCardModal";

const money = (v: string | number | undefined) =>
  `$${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AutoRefillCard() {
  const getAutoRefill = useBrandApiStore((state) => state.getAutoRefill);
  const loadSavedCards = useBrandApiStore((state) => state.loadSavedCards);
  const saveAutoRefill = useBrandApiStore((state) => state.saveAutoRefill);

  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState("250");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [recommended, setRecommended] = useState("0");
  const [triggerAt, setTriggerAt] = useState("0");
  const [estimate, setEstimate] = useState("0");
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [showSaveCard, setShowSaveCard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const reload = async () => {
    try {
      const [config, savedCards] = await Promise.all([getAutoRefill(), loadSavedCards()]);
      setEnabled(config.enabled);
      if (Number(config.amount) > 0) setAmount(String(config.amount));
      setPaymentMethodId(config.payment_method_id ?? "");
      setRecommended(String(config.recommended_amount ?? "0"));
      setTriggerAt(String(config.trigger_at ?? "0"));
      setEstimate(String(config.estimated_seven_day ?? "0"));
      setCards(savedCards);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load auto-refill.");
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCardSaved = async (pmId: string) => {
    setShowSaveCard(false);
    setPaymentMethodId(pmId);
    try {
      setCards(await loadSavedCards());
    } catch {
      /* non-fatal */
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveAutoRefill({
        enabled,
        amount: Number(amount).toFixed(2),
        payment_method_id: paymentMethodId,
      });
      setMessage("Auto-refill settings saved.");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full bg-white border border-[#C5C5D9]/10 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-[32px] p-8 flex flex-col gap-6">
      {showSaveCard && (
        <SaveCardModal onClose={() => setShowSaveCard(false)} onSaved={handleCardSaved} />
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col text-left">
          <span className="font-bold text-[#131B2E] text-lg">Automatic Refill</span>
          <span className="text-xs text-[#454656] font-medium mt-1">
            Nibbl tops up your wallet from a saved card when Available Funds reach
            25% of your estimated 7-day spend.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEnabled((value) => !value)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-[#001BD2]" : "bg-[#C5C5D9]/40"}`}
          aria-pressed={enabled}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${enabled ? "left-6" : "left-1"}`}
          />
        </button>
      </div>

      {/* Computed figures (read-only, from the backend) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#F2F3FF] p-4 rounded-2xl flex flex-col text-left gap-1">
          <span className="text-[10px] font-bold text-[#454656]/80 uppercase">Est. 7-day spend</span>
          <span className="text-lg font-bold text-[#131B2E]">{money(estimate)}</span>
        </div>
        <div className="bg-[#F2F3FF] p-4 rounded-2xl flex flex-col text-left gap-1">
          <span className="text-[10px] font-bold text-[#454656]/80 uppercase">Refills below</span>
          <span className="text-lg font-bold text-[#131B2E]">{money(triggerAt)}</span>
        </div>
        <div className="bg-[#F2F3FF] p-4 rounded-2xl flex flex-col text-left gap-1">
          <span className="text-[10px] font-bold text-[#454656]/80 uppercase">Recommended</span>
          <span className="text-lg font-bold text-[#001BD2]">{money(recommended)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 text-left">
        <span className="text-[11px] font-bold tracking-wider text-[#454656] uppercase">
          Refill amount
        </span>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative sm:w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#454656]">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#C5C5D9]/40 pl-7 pr-3 text-sm font-bold text-[#131B2E] outline-none focus:border-[#001BD2]"
            />
          </div>
          {Number(recommended) > 0 && (
            <button
              type="button"
              onClick={() => setAmount(Number(recommended).toFixed(2))}
              className="text-sm font-bold text-[#001BD2] hover:underline self-start sm:self-center"
            >
              Use recommended ({money(recommended)})
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 text-left">
        <span className="text-[11px] font-bold tracking-wider text-[#454656] uppercase">
          Card to charge
        </span>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <select
            value={paymentMethodId}
            onChange={(event) => setPaymentMethodId(event.target.value)}
            className="h-11 flex-1 rounded-xl border border-[#C5C5D9]/40 px-3 text-sm font-bold text-[#131B2E] outline-none focus:border-[#001BD2]"
          >
            <option value="">No card selected</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {(card.brand ?? "card").toUpperCase()} •••• {card.last4 ?? "----"}
                {card.exp_month ? `  (${card.exp_month}/${card.exp_year})` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowSaveCard(true)}
            className="h-11 rounded-xl border border-[#001BD2] px-5 text-sm font-extrabold text-[#001BD2] transition hover:bg-[#F2F3FF]"
          >
            + Save a card
          </button>
        </div>
      </div>

      {error && <p className="text-xs font-bold text-red-500">{error}</p>}
      {message && <p className="text-xs font-bold text-emerald-600">{message}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="h-11 self-start rounded-xl bg-[#001BD2] px-6 text-sm font-extrabold text-white transition hover:bg-[#001BD2]/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
