"use client";

import { useEffect, useState } from "react";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";
import { Pager, usePaged } from "@/features/dashboard/components/AdminPage";

const ROLES = [
  { value: "administrator", label: "Administrator", hint: "Everything, including Admin Users and Settings" },
  { value: "operations", label: "Operations", hint: "Day-to-day actions; can't change Settings or Admin Users" },
  { value: "analytics", label: "Analytics", hint: "Read-only" },
];
const roleLabel = (value: unknown) => ROLES.find((r) => r.value === value)?.label ?? String(value);
const when = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

/** Master Admin Settings → Admin Users (staff roles) + View Audit Log. */
export const AdminUsersPanel = () => {
  const [data, setData] = useState<ApiRecord | null>(null);
  const [form, setForm] = useState({ open: false, email: "", full_name: "", role: "operations" });
  const [logs, setLogs] = useState<ApiRecord[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    nibblApi
      .adminStaff()
      .then((result) => live && setData(result))
      .catch((err: Error) => live && setError(err.message || "Could not load Admin users."));
    return () => {
      live = false;
    };
  }, []);

  const run = async (action: () => Promise<ApiRecord>) => {
    setBusy(true);
    setError("");
    try {
      const result = await action();
      setData((d) => ({ ...d, ...result }));
      return true;
    } catch (err) {
      setError((err as Error).message || "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openAuditLog = async () => {
    setError("");
    try {
      setLogs(await nibblApi.adminAuditLogs());
    } catch (err) {
      setError((err as Error).message || "Could not load the audit log.");
    }
  };

  const users = (Array.isArray(data?.results) ? data.results : []) as ApiRecord[];
  const logsPage = usePaged(logs ?? [], 25);
  const canManage = data?.my_role === "administrator";

  return (
    <div className="bg-white border border-[#ECECF5] rounded-2xl p-6 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-[#1A1A2E]">Admin Users</h3>
        {canManage && (
          <button onClick={() => setForm((f) => ({ ...f, open: !f.open }))}
            className="h-9 px-4 rounded-full border border-[#3E3EDF]/40 text-[#3E3EDF] text-sm font-semibold cursor-pointer">+ Add User</button>
        )}
      </div>
      {form.open && (
        <div className="border border-[#ECECF5] rounded-xl p-4 flex flex-col gap-2">
          <input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Full name"
            className="h-10 px-3 rounded-lg border border-[#E0E0F0] text-sm" />
          <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" type="email"
            className="h-10 px-3 rounded-lg border border-[#E0E0F0] text-sm" />
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="h-10 px-3 rounded-lg border border-[#E0E0F0] text-sm">
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label} — {r.hint}</option>)}
          </select>
          <p className="text-xs text-[#6B6B80]">They get an email code to set their password, then sign in here.</p>
          <button disabled={busy || !form.email}
            onClick={() => void run(() => nibblApi.adminAddStaff(form)).then((ok) => ok && setForm({ open: false, email: "", full_name: "", role: "operations" }))}
            className="h-10 rounded-lg bg-[#3E3EDF] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">Add Admin User</button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[#9A9AB0] border-b border-[#ECECF5] uppercase">
            <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Role</th><th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const me = u.id === data?.me;
            return (
              <tr key={String(u.id)} className="border-b border-[#F6F6FB]">
                <td className="py-2 pr-3"><div className="font-semibold">{String(u.name)}{me ? " (you)" : ""}</div><div className="text-xs text-[#9A9AB0]">{String(u.email)}</div></td>
                <td className="py-2 pr-3">
                  {canManage && !me ? (
                    <select value={String(u.role)} disabled={busy}
                      onChange={(e) => void run(() => nibblApi.adminChangeStaffRole(String(u.id), e.target.value))}
                      className="h-8 px-2 rounded-lg border border-[#E0E0F0] text-xs">
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  ) : roleLabel(u.role)}
                </td>
                <td className="py-2 text-right">
                  {canManage && !me && (
                    <button disabled={busy}
                      onClick={() => window.confirm(`Remove Admin access for ${String(u.name)}?`) && void run(() => nibblApi.adminRemoveStaff(String(u.id)))}
                      className="text-xs font-semibold text-red-600 cursor-pointer">Remove</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button onClick={() => void openAuditLog()}
        className="self-start h-10 px-4 rounded-lg border border-[#E0E0F0] text-sm font-semibold text-[#1A1A2E] cursor-pointer">View Audit Log</button>

      {logs && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setLogs(null)}>
          <div className="w-full max-w-[860px] max-h-[80vh] bg-white rounded-2xl p-6 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1A1A2E]">Audit Log</h3>
              <button onClick={() => setLogs(null)} className="text-sm font-semibold text-[#3E3EDF] cursor-pointer">Close</button>
            </div>
            <p className="text-xs text-[#6B6B80]">The latest 200 sensitive actions: approvals, wallet adjustments, suspensions, payout changes, role changes and Admin Mode actions.</p>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[#9A9AB0] border-b border-[#ECECF5]">
                    <th className="py-2 pr-3">When</th><th className="py-2 pr-3">Event</th><th className="py-2 pr-3">Actor</th>
                    <th className="py-2 pr-3">Target</th><th className="py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logsPage.items.map((log) => {
                    const meta = (log.metadata ?? {}) as ApiRecord;
                    const { event, ...rest } = meta;
                    return (
                      <tr key={String(log.id)} className="border-b border-[#F6F6FB] align-top">
                        <td className="py-2 pr-3 whitespace-nowrap">{when(log.created_at)}</td>
                        <td className="py-2 pr-3">{String(event || log.action).replaceAll("_", " ")}</td>
                        <td className="py-2 pr-3">{String(log.actor_type)} {String(log.actor_id).slice(0, 8)}</td>
                        <td className="py-2 pr-3">{String(log.target_type)} {String(log.target_id).slice(0, 8)}</td>
                        <td className="py-2 break-all text-[#6B6B80]">
                          {Object.entries(rest).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager paged={logsPage} noun="entries" />
          </div>
        </div>
      )}
    </div>
  );
};
