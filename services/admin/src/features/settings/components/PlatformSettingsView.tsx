"use client";

import React, { useEffect, useState } from "react";
import { useAdminApiStore } from "@/stores/useAdminApiStore";
import { AdminUsersPanel } from "./AdminUsersPanel";
import { ProductCategoriesPanel } from "./ProductCategoriesPanel";
import { SettingsSubTab } from "@/types/settings.types";
import { ChevronRight } from "lucide-react";

interface PlatformSettingsViewProps {
  /** Opens one of the account / content pages (profile, password, FAQ…). */
  onOpen: (tab: SettingsSubTab) => void;
}

type Draft = Record<string, string | boolean>;

export const PlatformSettingsView: React.FC<PlatformSettingsViewProps> = ({ onOpen }) => {
  const { platformSettings, loadPlatformSettings, savePlatformSettings } = useAdminApiStore();
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadPlatformSettings();
  }, [loadPlatformSettings]);

  const text = (field: string) =>
    draft[field] !== undefined
      ? String(draft[field])
      : String(platformSettings?.[field] ?? "");
  const bool = (field: string) =>
    draft[field] !== undefined
      ? Boolean(draft[field])
      : Boolean(platformSettings?.[field]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await savePlatformSettings({
        withdrawal_review_single: text("withdrawal_review_single"),
        withdrawal_review_rolling: text("withdrawal_review_rolling"),
        withdrawal_rolling_days: Number(text("withdrawal_rolling_days")),
        referrals_enabled: bool("referrals_enabled"),
        ranking_prior_views: Number(text("ranking_prior_views")),
        ranking_prior_redemptions: Number(text("ranking_prior_redemptions")),
        store_match_multiplier: text("store_match_multiplier"),
        brand_interest_multiplier: text("brand_interest_multiplier"),
        going_fast_percent: Number(text("going_fast_percent")),
        device_checks_enabled: bool("device_checks_enabled"),
        max_accounts_per_device: Number(text("max_accounts_per_device")),
        max_accounts_per_ip_daily: Number(text("max_accounts_per_ip_daily")),
        referral_flag_shared_device: bool("referral_flag_shared_device"),
        referral_flag_shared_network: bool("referral_flag_shared_network"),
        referral_flag_fraud_signals: bool("referral_flag_fraud_signals"),
        referral_flag_duplicate_payout: bool("referral_flag_duplicate_payout"),
        referral_flag_self_referral: bool("referral_flag_self_referral"),
        referral_flag_unusual_volume: bool("referral_flag_unusual_volume"),
        referral_volume_limit: Number(text("referral_volume_limit")),
      });
      setDraft({});
      setMessage("Settings saved.");
    } catch (err) {
      setMessage((err as Error).message || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full h-11 px-3 rounded-lg border border-[#E0E0F0] text-[15px] text-[#1A1A2E] outline-none focus:border-[#3E3EDF] focus:ring-2 focus:ring-[#3E3EDF]/15";

  const card = "bg-white border border-[#ECECF5] rounded-2xl p-6 shadow-sm flex flex-col gap-4";
  const title = "text-lg font-bold text-[#3E3EDF]";

  return (
    <div className="w-full flex flex-col gap-6 font-inter">
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Settings</h1>
        <p className="text-sm text-[#6B6B80] mt-1">Control essential Admin rules.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <section className={card}>
          <div>
            <h2 className={title}>Withdrawal Review Rules</h2>
            <p className="text-sm text-[#6B6B80] mt-1">Withdrawals above either threshold go to Manual Review.</p>
          </div>
        <label className="flex flex-col gap-1 text-sm font-semibold text-[#454656]">
          Single withdrawal over ($)
          <input
            className={inputClass}
            type="number"
            min="0"
            step="0.01"
            value={text("withdrawal_review_single")}
            onChange={(e) => setDraft({ ...draft, withdrawal_review_single: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-[#454656]">
          Rolling-window total over ($)
          <input
            className={inputClass}
            type="number"
            min="0"
            step="0.01"
            value={text("withdrawal_review_rolling")}
            onChange={(e) => setDraft({ ...draft, withdrawal_review_rolling: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-[#454656]">
          Rolling window (days)
          <input
            className={inputClass}
            type="number"
            min="1"
            step="1"
            value={text("withdrawal_rolling_days")}
            onChange={(e) => setDraft({ ...draft, withdrawal_rolling_days: e.target.value })}
          />
        </label>

        </section>

        <section className={card}>
          <div>
            <h2 className={title}>Referral Flag Rules</h2>
            <p className="text-xs text-[#6B6B80] mt-1">A qualified referral matching an enabled rule goes to Referrals for review instead of paying.</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-[#454656] mt-2">
            <input
              type="checkbox"
              checked={bool("referrals_enabled")}
              onChange={(e) => setDraft({ ...draft, referrals_enabled: e.target.checked })}
            />
            Referral bonuses enabled
          </label>
          {[
            { field: "referral_flag_duplicate_payout", label: "Duplicate payout identity" },
            { field: "referral_flag_shared_device", label: "Same device" },
            { field: "referral_flag_self_referral", label: "Self-referral (same name, email or phone)" },
            { field: "referral_flag_unusual_volume", label: "Unusual referral volume" },
            { field: "referral_flag_shared_network", label: "Same network (additional check)" },
            { field: "referral_flag_fraud_signals", label: "Fraud signals on either account (additional check)" },
          ].map((f) => (
            <label key={f.field} className="flex items-center gap-2 text-sm font-medium text-[#454656] mt-2">
              <input type="checkbox" checked={bool(f.field)}
                onChange={(e) => setDraft({ ...draft, [f.field]: e.target.checked })} />
              {f.label}
            </label>
          ))}
          <label className="flex flex-col gap-1 text-sm font-semibold text-[#454656] mt-3">
            Unusual volume: more than this many referrals in 7 days
            <input className={inputClass} type="number" min="1" step="1" value={text("referral_volume_limit")}
              onChange={(e) => setDraft({ ...draft, referral_volume_limit: e.target.value })} />
          </label>
        </section>

        <section className={card}>
          <div>
            <h2 className={title}>Discovery Ranking</h2>
            <p className="text-sm text-[#6B6B80] mt-1">
              Eligible campaigns are ranked by Base CVR × Store Match × Brand Interest. Base CVR = (redemptions +
              starting redemptions) ÷ (views + starting views) over 30 days, so new campaigns get a fair start.
            </p>
          </div>
          {[
            { field: "ranking_prior_views", label: "Starting views (pseudo-data)", step: "1", min: "1" },
            { field: "ranking_prior_redemptions", label: "Starting redemptions (pseudo-data)", step: "1", min: "0" },
            { field: "store_match_multiplier", label: "Store Match boost (×) — shopper bought at one of the campaign's retailers", step: "0.05", min: "1" },
            { field: "brand_interest_multiplier", label: "Brand Interest boost (×) — viewed, claimed or redeemed with the brand in 30 days", step: "0.05", min: "1" },
            { field: "going_fast_percent", label: "\"Going fast\" when this % or less of the 25-hour capacity remains", step: "1", min: "1" },
          ].map((f) => (
            <label key={f.field} className="flex flex-col gap-1 text-sm font-semibold text-[#454656]">
              {f.label}
              <input
                className={inputClass}
                type="number"
                min={f.min}
                step={f.step}
                value={text(f.field)}
                onChange={(e) => setDraft({ ...draft, [f.field]: e.target.value })}
              />
            </label>
          ))}
        </section>

        <AdminUsersPanel />

        <section className={card}>
          <div>
            <h2 className={title}>Device &amp; Network Checks</h2>
            <p className="text-sm text-[#6B6B80] mt-1">
              Receipts and withdrawals from accounts over these limits go to manual review. Shoppers aren&apos;t told
              which rule applied.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-[#454656]">
            <input type="checkbox" checked={bool("device_checks_enabled")}
              onChange={(e) => setDraft({ ...draft, device_checks_enabled: e.target.checked })} />
            Device and network checks enabled
          </label>
          {[
            { field: "max_accounts_per_device", label: "Max accounts per device (90 days)" },
            { field: "max_accounts_per_ip_daily", label: "Max accounts per network in 24 hours" },
          ].map((f) => (
            <label key={f.field} className="flex flex-col gap-1 text-sm font-semibold text-[#454656]">
              {f.label}
              <input className={inputClass} type="number" min="1" step="1" value={text(f.field)}
                onChange={(e) => setDraft({ ...draft, [f.field]: e.target.value })} />
            </label>
          ))}
        </section>

        <ProductCategoriesPanel />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {message && <span className="text-sm font-medium text-[#3E3EDF]">{message}</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-11 px-6 bg-[#3E3EDF] hover:bg-[#3333c4] text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <section className={card}>
        <h2 className="text-base font-bold text-[#1A1A2E]">Account &amp; content</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
          {([
            ["personal-info", "Personal Information"],
            ["change-password", "Change Password"],
            ["faq", "FAQ"],
            ["privacy-policy", "Privacy Policy"],
            ["terms-conditions", "Terms & Conditions"],
          ] as [SettingsSubTab, string][]).map(([tab, label]) => (
            <button key={tab} type="button" onClick={() => onOpen(tab)}
              className="flex items-center justify-between gap-2 rounded-xl border border-[#ECECF5] px-4 py-3 text-sm font-medium text-[#1A1A2E] hover:border-[#3E3EDF] cursor-pointer">
              {label} <ChevronRight className="w-4 h-4 text-[#9A9AB0]" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
