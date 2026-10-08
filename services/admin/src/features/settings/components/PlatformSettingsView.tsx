"use client";

import React, { useEffect, useState } from "react";
import { useAdminApiStore } from "@/stores/useAdminApiStore";

interface PlatformSettingsViewProps {
  onBack: () => void;
}

type Draft = Record<string, string | boolean>;

export const PlatformSettingsView: React.FC<PlatformSettingsViewProps> = ({ onBack }) => {
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

  return (
    <div className="w-full flex flex-col gap-6 font-inter max-w-[640px]">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm font-semibold text-[#3E3EDF] hover:underline cursor-pointer"
        >
          ← Back
        </button>
        <h2 className="text-xl font-bold text-[#1A1A2E]">Platform Settings</h2>
      </div>

      <div className="bg-white border border-[#ECECF5] rounded-2xl p-6 shadow-sm flex flex-col gap-5">
        <div>
          <h3 className="text-base font-bold text-[#1A1A2E]">Withdrawal review thresholds</h3>
          <p className="text-sm text-[#6B6B80] mt-1">
            Withdrawals above either threshold are flagged for closer review.
          </p>
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

        <div className="border-t border-[#F0F0F7] pt-4">
          <h3 className="text-base font-bold text-[#1A1A2E]">Referrals</h3>
          <label className="flex items-center gap-2 text-sm font-medium text-[#454656] mt-2">
            <input
              type="checkbox"
              checked={bool("referrals_enabled")}
              onChange={(e) => setDraft({ ...draft, referrals_enabled: e.target.checked })}
            />
            Referral bonuses enabled
          </label>
        </div>

        {message && (
          <div className="text-sm font-medium text-[#3E3EDF]">{message}</div>
        )}

        <div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-11 px-6 bg-[#3E3EDF] hover:bg-[#3333c4] text-white font-semibold text-sm rounded-full transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
};
