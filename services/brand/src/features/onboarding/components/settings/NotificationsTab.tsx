"use client";

import { useEffect, useState } from "react";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

const Toggle = ({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange}
    className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${on ? "bg-[#001BD2]" : "bg-slate-300"}`}>
    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
  </button>
);

/** Master Settings §3: each team member manages their own notifications,
 *  with a separate Email and SMS toggle for every notification. */
export default function NotificationsTab() {
  const brandId = useBrandApiStore((s) => s.selectedBrandId);
  const [rows, setRows] = useState<ApiRecord[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!brandId) return;
    let live = true;
    apiClient
      .request<ApiRecord[]>(backendApi.brand.notificationPreferences(brandId))
      .then((data) => live && setRows(data))
      .catch((err) => live && setMessage(err instanceof Error ? err.message : "Could not load notifications."));
    return () => {
      live = false;
    };
  }, [brandId]);

  const flip = (type: unknown, channel: "email" | "sms") =>
    setRows((cur) => (cur ?? []).map((row) => (row.type === type ? { ...row, [channel]: !row[channel] } : row)));

  const save = async () => {
    if (!brandId || !rows) return;
    setSaving(true);
    setMessage("");
    try {
      setRows(await apiClient.request<ApiRecord[]>(backendApi.brand.updateNotificationPreferences(brandId), {
        body: { preferences: rows.map(({ type, email, sms }) => ({ type, email, sms })) },
      }));
      setMessage("Your notification preferences were saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save preferences.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[860px]">
      <div>
        <h2 className="font-jakarta font-extrabold text-2xl text-[#131B2E]">Notifications</h2>
        <p className="text-xs text-[#454656] font-medium mt-1">
          These are your own preferences — they don&apos;t change anyone else on your team. In-app notifications are
          always on.
        </p>
      </div>
      <section className="bg-white border border-[#EAEDFF] rounded-[20px] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F2F3FF] text-[10px] font-bold uppercase tracking-wider text-[#454656]">
              <th className="p-4 text-left">Notification</th>
              <th className="p-4 w-20">Email</th>
              <th className="p-4 w-20">SMS</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row) => (
              <tr key={String(row.type)} className="border-t border-[#F1F2FA]">
                <td className="p-4">
                  <div className="font-semibold text-[#131B2E]">{String(row.label)}</div>
                  <div className="text-xs text-[#64748B]">{String(row.description)}</div>
                </td>
                <td className="p-4 text-center">
                  <Toggle on={Boolean(row.email)} onChange={() => flip(row.type, "email")} label={`${row.label} email`} />
                </td>
                <td className="p-4 text-center">
                  <Toggle on={Boolean(row.sms)} onChange={() => flip(row.type, "sms")} label={`${row.label} SMS`} />
                </td>
              </tr>
            ))}
            {rows === null && (
              <tr><td colSpan={3} className="p-8 text-center text-slate-400">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </section>
      <div className="flex items-center justify-end gap-3">
        {message && <span className="text-xs font-bold text-[#001BD2]">{message}</span>}
        <button type="button" onClick={() => void save()} disabled={saving || !rows}
          className="h-10 px-6 rounded-full bg-[#001BD2] text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
          {saving ? "Saving…" : "Save preferences"}
        </button>
      </div>
      <p className="text-xs text-[#94A3B8]">
        SMS uses the mobile number on your account. Text messages start once Nibbl&apos;s SMS service is connected.
      </p>
    </div>
  );
}
