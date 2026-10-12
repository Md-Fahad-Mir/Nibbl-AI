"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";
import { AdminPage, Kpi, Notice, btn, selectCls, shortDate } from "@/features/dashboard/components/AdminPage";

/** Master Admin Sheet 3 "Suspensions": shoppers suspended by individual
 *  brands — review, remove a brand suspension or apply a global suspension. */
export const SuspensionsView = () => {
  const router = useRouter();
  const [filters, setFilters] = useState({ q: "", status: "", days: "30" });
  const [data, setData] = useState<ApiRecord | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    nibblApi
      .adminSuspensions(filters)
      .then((result) => live && setData(result))
      .catch((err: Error) => live && setError(err.message || "Could not load suspensions."));
    return () => {
      live = false;
    };
  }, [filters, reloadKey]);

  const summary = (data?.summary ?? {}) as ApiRecord;
  const rows = (Array.isArray(data?.results) ? data.results : []) as ApiRecord[];
  const selected = rows.find((r) => r.id === selectedId);

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

  const set = (key: keyof typeof filters) => (e: { target: { value: string } }) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <AdminPage active="suspensions" title="Suspensions" subtitle="Review brand suspensions and repeated customer issues.">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi label="Active brand suspensions" value={String(summary.active_brand_suspensions ?? "—")} />
        <Kpi label="Repeat suspensions" value={String(summary.repeat_suspensions ?? "—")}
          tone={Number(summary.repeat_suspensions) ? "text-red-600" : ""} />
        <Kpi label="Global suspensions" value={String(summary.global_suspensions ?? "—")} />
      </div>
      <Notice error={error} notice={notice} />

      <div className="flex flex-col xl:flex-row gap-5 items-start">
        <section className="flex-1 min-w-0 w-full bg-white border border-[#ECECF5] rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <input value={filters.q} onChange={set("q")} placeholder="Search by shopper, brand or reason"
              className="h-9 px-4 rounded-full border border-[#E0E0F0] text-xs flex-1 min-w-48" />
            <select value={filters.status} onChange={set("status")} className={selectCls}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="removed">Removed</option>
            </select>
            <select value={filters.days} onChange={set("days")} className={selectCls}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="">All time</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#9A9AB0] border-b border-[#ECECF5] uppercase">
                  <th className="py-2 pr-3">Shopper</th><th className="py-2 pr-3">Brand</th><th className="py-2 pr-3">Reason</th>
                  <th className="py-2 pr-3">Date</th><th className="py-2 pr-3 text-right">Prior brand suspensions</th><th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)} onClick={() => setSelectedId(String(r.id))}
                    className={`border-b border-[#F6F6FB] cursor-pointer ${selectedId === r.id ? "bg-[#F2F3FF]" : "hover:bg-[#FAFAFE]"}`}>
                    <td className="py-2 pr-3 font-semibold text-[#1A1A2E]">{String(r.shopper)}{r.repeated ? <span title="Repeated suspensions" className="text-red-600"> ⚠</span> : null}</td>
                    <td className="py-2 pr-3">{String(r.brand)}</td>
                    <td className="py-2 pr-3">{String(r.reason || "—")}</td>
                    <td className="py-2 pr-3 text-xs">{shortDate(r.date)}</td>
                    <td className="py-2 pr-3 text-right">{String(r.prior_brand_suspensions)}</td>
                    <td className="py-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        r.status === "active" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {r.status === "active" ? "Active" : "Removed"}
                      </span>
                    </td>
                  </tr>
                ))}
                {data && rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-[#9A9AB0]">No suspensions match.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {selected && (
          <aside className="w-full xl:w-[340px] bg-white border border-[#ECECF5] rounded-2xl p-5 flex flex-col gap-3 text-sm">
            <div>
              <h2 className="text-lg font-bold text-[#1A1A2E]">{String(selected.shopper)}</h2>
              <p className="text-xs text-[#6B6B80]">Shopper ID: {String(selected.shopper_ref)}</p>
            </div>
            {[["Brand", selected.brand], ["Reason", selected.reason || "—"], ["Date", shortDate(selected.date)],
              ["Prior brand suspensions", selected.prior_brand_suspensions]].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-3"><span className="text-[#6B6B80]">{String(k)}</span><span className="font-semibold text-right">{String(v)}</span></div>
            ))}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button onClick={() => router.push(`/users?shopper=${String(selected.shopper_id)}`)}
                className={`${btn} border border-[#3E3EDF]/40 text-[#3E3EDF] text-xs`}>View Shopper</button>
              <button disabled={busy || selected.status !== "active"}
                onClick={() => void run("Brand suspension removed.", () => nibblApi.adminRemoveSuspension(String(selected.id), "Removed by Nibbl Admin"))}
                className={`${btn} border border-[#3E3EDF]/40 text-[#3E3EDF] text-xs`}>Remove Brand Suspension</button>
            </div>
            <button disabled={busy || Boolean(selected.globally_suspended)}
              onClick={() => void run("Shopper globally suspended.", () =>
                nibblApi.adminShopperSuspend(String(selected.shopper_id), true, `Global suspension after brand suspension: ${String(selected.reason || "")}`))}
              className={`${btn} border border-red-300 text-red-600 text-xs`}>
              {selected.globally_suspended ? "Globally Suspended" : "Globally Suspend"}
            </button>
            <p className="text-xs text-[#6B6B80] bg-[#F6F6FB] rounded-lg p-2">
              ⓘ Repeated suspensions create an Admin alert; they do not automatically create a global suspension.
            </p>
          </aside>
        )}
      </div>
    </AdminPage>
  );
};
