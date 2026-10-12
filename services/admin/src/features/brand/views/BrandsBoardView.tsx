"use client";

import { useEffect, useState } from "react";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";
import { useAdminApiStore } from "@/stores/useAdminApiStore";
import { AdminPage, Kpi, Notice, btn, money, selectCls, shortDate } from "@/features/dashboard/components/AdminPage";

const PAYMENT: Record<string, [string, string]> = {
  connected: ["Connected", "bg-emerald-500"],
  failed: ["Failed", "bg-red-500"],
  not_connected: ["Not connected", "bg-slate-300"],
};

/** Master Admin Sheet 2 "Brands": KPIs, searchable table, selected-brand
 *  summary and actions (Admin Mode, promotional credit, suspend). */
export const BrandsBoardView = () => {
  const { brands: legacyRows, loadDashboard, approveBrand, rejectBrandApplication } = useAdminApiStore();
  const [filters, setFilters] = useState({ q: "", category: "", plan: "", status: "", sort: "lowest" });
  const [data, setData] = useState<ApiRecord | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [summary, setSummary] = useState<ApiRecord | null>(null);
  const [credit, setCredit] = useState({ open: false, amount: "", note: "" });
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    let live = true;
    nibblApi
      .adminBrandBoard(filters)
      .then((result) => live && setData(result))
      .catch((err: Error) => live && setError(err.message || "Could not load brands."));
    return () => {
      live = false;
    };
  }, [filters, reloadKey]);

  useEffect(() => {
    if (!selected) return;
    let live = true;
    nibblApi
      .adminBrandSummary(selected)
      .then((result) => live && setSummary(result))
      .catch((err: Error) => live && setError(err.message || "Could not load the brand."));
    return () => {
      live = false;
    };
  }, [selected, reloadKey]);

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(label);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message || "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const openDashboard = async () => {
    setError("");
    // Open the tab now (inside the click) so pop-up blockers allow it.
    const tab = window.open("", "_blank");
    try {
      const { url } = await nibblApi.adminBrandAccess(selected);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (err) {
      tab?.close();
      setError((err as Error).message || "Could not open the brand dashboard.");
    }
  };

  const kpis = (data?.kpis ?? {}) as ApiRecord;
  const rows = (Array.isArray(data?.results) ? data.results : []) as ApiRecord[];
  const categories = (Array.isArray(data?.categories) ? data.categories : []) as string[];
  const pending = legacyRows.filter((b) => b.source === "brand-application" && b.canApprove);
  const set = (key: keyof typeof filters) => (e: { target: { value: string } }) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  const suspended = summary?.status === "suspended";

  return (
    <AdminPage active="brand" title="Brands" subtitle="Manage brand accounts, revenue and access.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Active brands" value={String(kpis.active ?? "—")} />
        <Kpi label="Pending verification" value={String(kpis.pending_verification ?? "—")} />
        <Kpi label="Failed payments" value={String(kpis.failed_payments ?? "—")} tone={Number(kpis.failed_payments) ? "text-red-600" : ""} />
        <Kpi label="Suspended" value={String(kpis.suspended ?? "—")} />
      </div>
      <Notice error={error} notice={notice} />

      {pending.length > 0 && (
        <section className="bg-white border border-amber-200 rounded-2xl p-5 flex flex-col gap-3">
          <h2 className="text-sm font-bold text-[#1A1A2E]">Pending verification</h2>
          {pending.map((app) => (
            <div key={app.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span><b>{app.brandName}</b> · {app.email} · {app.date}</span>
              <span className="flex gap-2">
                <button onClick={() => void run("Brand approved.", () => approveBrand(app))} disabled={busy}
                  className={`${btn} bg-[#3E3EDF] text-white`}>Approve</button>
                <button onClick={() => void run("Application rejected.", () => rejectBrandApplication(app.id))} disabled={busy}
                  className={`${btn} border border-red-200 text-red-600`}>Reject</button>
              </span>
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-col xl:flex-row gap-5 items-start">
        <section className="flex-1 min-w-0 w-full bg-white border border-[#ECECF5] rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <input value={filters.q} onChange={set("q")} placeholder="Search brands"
              className="h-9 px-4 rounded-full border border-[#E0E0F0] text-xs w-48" />
            <select value={filters.category} onChange={set("category")} className={selectCls}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filters.plan} onChange={set("plan")} className={selectCls}>
              <option value="">All plans</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="scale">Scale</option>
            </select>
            <select value={filters.status} onChange={set("status")} className={selectCls}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <select value={filters.sort} onChange={set("sort")} className={selectCls}>
              <option value="lowest">Lowest revenue</option>
              <option value="highest">Highest revenue</option>
              <option value="recent">Recent activity</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#9A9AB0] border-b border-[#ECECF5] uppercase">
                  <th className="py-2 pr-4">Brand</th><th className="py-2 pr-4">Category</th><th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4 text-right">Nibbl revenue</th><th className="py-2 pr-4 text-right">Wallet funds</th>
                  <th className="py-2 pr-4">Payment</th><th className="py-2 pr-4">Last activity</th><th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const [label, dot] = PAYMENT[String(b.payment_status)] ?? PAYMENT.not_connected;
                  return (
                    <tr key={String(b.id)} onClick={() => setSelected(String(b.id))}
                      className={`border-b border-[#F6F6FB] cursor-pointer ${selected === b.id ? "bg-[#F2F3FF]" : "hover:bg-[#FAFAFE]"}`}>
                      <td className="py-2 pr-4 font-semibold text-[#1A1A2E]">{String(b.name)}</td>
                      <td className="py-2 pr-4">{String(b.category || "—")}</td>
                      <td className="py-2 pr-4">{String(b.plan ?? "—")}</td>
                      <td className="py-2 pr-4 text-right">{money(b.nibbl_revenue)}</td>
                      <td className="py-2 pr-4 text-right">{money(b.wallet_funds)}</td>
                      <td className="py-2 pr-4"><span className={`inline-block w-2 h-2 rounded-full mr-2 ${dot}`} />{label}</td>
                      <td className="py-2 pr-4 text-xs text-[#6B6B80]">{shortDate(b.last_activity)}</td>
                      <td className="py-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          b.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                          {b.status === "active" ? "Active" : "Suspended"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {data && rows.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-[#9A9AB0]">No brands match.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {selected && summary && (
          <aside className="w-full xl:w-[360px] bg-white border border-[#ECECF5] rounded-2xl overflow-hidden flex flex-col">
            <div className="bg-[#3E3EDF] text-white text-xs px-4 py-3">
              <b>Nibbl Admin Mode</b> — opening the dashboard shows {String(summary.name)} as a Nibbl superuser. Every action is logged.
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[#1A1A2E]">{String(summary.name)}</h2>
                  {Boolean(summary.verified) && <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Verified</span>}
                </div>
                <p className="text-xs text-[#6B6B80]">{[summary.category, summary.plan && `${String(summary.plan)} Plan`].filter(Boolean).map(String).join(" · ")}</p>
              </div>
              <dl className="text-sm flex flex-col gap-2">
                {[
                  ["Payment connected", summary.payment_connected ? "Yes" : summary.payment_status === "failed" ? "Failed" : "No"],
                  ["Wallet funds", money(summary.wallet_funds)],
                  ["Promotional credits", money(summary.promotional_credits)],
                  ["Total Nibbl revenue", money(summary.nibbl_revenue)],
                  ["Active campaigns", String(summary.active_campaigns)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between"><dt className="text-[#6B6B80]">{k}</dt><dd className="font-semibold">{v}</dd></div>
                ))}
              </dl>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => void openDashboard()} className={`${btn} bg-[#3E3EDF] text-white text-xs px-2`}>Open Brand Dashboard</button>
                <button onClick={() => setCredit({ open: true, amount: "", note: "" })} className={`${btn} border border-[#3E3EDF]/40 text-[#3E3EDF] text-xs px-2`}>Add Promotional Credit</button>
                <button disabled={busy}
                  onClick={() => void run(suspended ? "Brand reactivated." : "Brand suspended.",
                    () => nibblApi.adminBrandAction(selected, suspended ? "reactivate" : "suspend"))}
                  className={`${btn} border text-xs px-2 ${suspended ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-600"}`}>
                  {suspended ? "Reactivate Brand" : "Suspend Brand"}
                </button>
              </div>
              {credit.open && (
                <div className="border border-[#ECECF5] rounded-xl p-3 flex flex-col gap-2">
                  <input value={credit.amount} onChange={(e) => setCredit((c) => ({ ...c, amount: e.target.value }))}
                    placeholder="Amount (USD)" inputMode="decimal" className="h-9 px-3 rounded-lg border border-[#E0E0F0] text-sm" />
                  <input value={credit.note} onChange={(e) => setCredit((c) => ({ ...c, note: e.target.value }))}
                    placeholder="Note (shown in the brand's ledger)" className="h-9 px-3 rounded-lg border border-[#E0E0F0] text-sm" />
                  <p className="text-[11px] text-[#6B6B80]">Promotional credits never fund shopper rewards.</p>
                  <button disabled={busy || !credit.amount}
                    onClick={() => void run("Promotional credit added.", async () => {
                      await nibblApi.adminBrandCredit(selected, credit.amount, credit.note);
                      setCredit({ open: false, amount: "", note: "" });
                    })}
                    className={`${btn} bg-[#3E3EDF] text-white`}>Add Credit</button>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </AdminPage>
  );
};
