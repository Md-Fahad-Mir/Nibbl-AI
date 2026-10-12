"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/features/dashboard/components/Sidebar";
import { Header } from "@/features/dashboard/components/Header";
import { SectionTabs } from "@/features/dashboard/components/SectionTabs";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useAdminApiStore } from "@/stores/useAdminApiStore";
import { API_BASE_URL, ApiRecord, nibblApi, tokenStorage } from "@/lib/api/backendApi";

// Master Admin Sheet 1 — Withdrawals.
const TABS = [
  { value: "ready", label: "Ready for Batch" },
  { value: "review", label: "Manual Review" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

const money = (value: unknown) => `$${Number(value ?? 0).toFixed(2)}`;
const when = (value: unknown) => (value ? new Date(String(value)).toLocaleString() : "—");
const provider = (value: unknown) => (String(value) === "venmo" ? "Venmo" : "PayPal");

const downloadBatchFile = async (batchId: string) => {
  const token = tokenStorage.getAccess();
  const response = await fetch(`${API_BASE_URL}/admin/payout-batches/${batchId}/paypal-file/`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Could not download the PayPal file.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `paypal-payouts-${batchId.slice(0, 8)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const ManualReviewPanel = ({ row, onDone }: { row: ApiRecord; onDone: (msg: string) => void }) => {
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const history = (row.history ?? {}) as ApiRecord;

  const act = async (action: "approve" | "reject") => {
    setBusy(true);
    setError("");
    try {
      await nibblApi.withdrawalAction(String(row.id), action, action === "reject" ? { reason } : {});
      onDone(action === "approve" ? "Approved — moved to Ready for Batch." : "Rejected — the amount went back to the shopper's balance.");
    } catch (err) {
      setError((err as Error).message || "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="bg-white border border-[#ECECF5] rounded-2xl p-5 flex flex-col gap-3 text-sm">
      <h3 className="font-bold text-[#1A1A2E]">Manual Review</h3>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><div className="text-[#9A9AB0]">Withdrawal ID</div><div className="font-semibold">{String(row.reference)}</div></div>
        <div><div className="text-[#9A9AB0]">Amount</div><div className="font-semibold">{money(row.amount)}</div></div>
        <div><div className="text-[#9A9AB0]">Shopper</div><div className="font-semibold">{String(row.shopper_name || "—")}</div>
          <div className="text-[#6B6B80]">{String(row.shopper_email)}</div></div>
        <div><div className="text-[#9A9AB0]">Requested</div><div className="font-semibold">{when(row.requested_at)}</div></div>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-amber-800">
        <b>Flag reason:</b> {String(row.flag_reason || "Matched a withdrawal review rule.")}
      </div>
      <div className="bg-[#F6F6FB] rounded-xl p-3 text-xs text-[#454656]">
        Shopper history: {String(history.total ?? 0)} total withdrawals · {String(history.completed ?? 0)} completed · {String(history.failed ?? 0)} failed
      </div>
      {rejecting && (
        <input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
          placeholder="Reason shown to the shopper (required)"
          className="h-10 px-3 rounded-lg border border-[#E0E0F0] text-sm outline-none focus:border-[#3E3EDF]" />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button disabled={busy} onClick={() => void act("approve")}
          className="h-9 px-4 rounded-full bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">
          Approve
        </button>
        <button disabled={busy || (rejecting && !reason.trim())}
          onClick={() => (rejecting ? void act("reject") : setRejecting(true))}
          className="h-9 px-4 rounded-full border border-red-200 text-red-600 text-sm font-semibold disabled:opacity-50 cursor-pointer">
          {rejecting ? "Confirm reject" : "Reject"}
        </button>
      </div>
    </aside>
  );
};

/** Master Withdrawals: payout batches + flagged requests. Safe requests are
 *  Ready for Batch automatically; PayPal results mark them Paid or Failed. */
export const WithdrawRequestView = () => {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { profile, loadProfile, logout } = useAdminApiStore();
  const [tab, setTab] = useState("ready");
  const [q, setQ] = useState("");
  const [data, setData] = useState<ApiRecord | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [batches, setBatches] = useState<ApiRecord[] | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      nibblApi
        .withdrawalBoard(tab, q.trim())
        .then((result) => live && (setData(result), setError("")))
        .catch((err: Error) => live && setError(err.message || "Could not load withdrawals."));
    }, 200);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [tab, q, reloadKey]);

  const rows = useMemo(() => (Array.isArray(data?.results) ? data.results : []) as ApiRecord[], [data]);
  const counts = (data?.counts ?? {}) as ApiRecord;
  const fee = Number(data?.fee_per_payout ?? 0);
  const picked = rows.filter((r) => selected.includes(String(r.id)));
  const payouts = picked.reduce((sum, r) => sum + Number(r.amount), 0);
  const reviewRow = rows.find((r) => String(r.id) === reviewId) ?? (tab === "review" ? rows[0] : undefined);

  const reload = (msg = "") => {
    setNotice(msg);
    setSelected([]);
    setReloadKey((k) => k + 1);
  };

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const createBatch = () =>
    run(async () => {
      const batch = await nibblApi.createPayoutBatch(selected);
      await downloadBatchFile(String(batch.id));
      setTab("processing");
      reload(`Batch created with ${String(batch.count)} withdrawals — the PayPal file was downloaded. Upload it to PayPal Payouts.`);
    });

  const importResults = (file: File) =>
    run(async () => {
      const summary = await nibblApi.importPayoutResults(file);
      const unmatched = Array.isArray(summary.unmatched) ? summary.unmatched.length : 0;
      reload(
        `Imported: ${String(summary.paid)} paid, ${String(summary.failed)} failed, ${String(summary.still_processing)} still processing, ` +
          `${String(summary.already_recorded)} already recorded${unmatched ? `, ${unmatched} not matched` : ""}.`
      );
    });

  const failedAction = (row: ApiRecord, action: "retry" | "return-funds") =>
    run(async () => {
      await nibblApi.withdrawalAction(String(row.id), action);
      reload(action === "retry" ? "Moved back to Ready for Batch." : "Closed as failed — the amount went back to the shopper's balance.");
    });

  const handleNavSelect = (item: SidebarNavItem) => {
    if (item === "logout") {
      logout();
      router.push("/");
      return;
    }
    router.push(`/${item}`);
  };

  return (
    <div className="flex min-h-screen w-full bg-[#FEFEFE]">
      <Sidebar activeNav="withdraw-request" onNavSelect={handleNavSelect} isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)} />
      <main className="flex-1 w-full min-h-screen p-4 sm:p-6 md:p-8 flex flex-col gap-5 items-stretch bg-[#FEFEFE] overflow-x-hidden font-inter">
        <Header adminName={String(profile?.full_name || profile?.email || "Admin")} adminRole={String(profile?.role || "Admin")}
          unreadCount={0} onToggleMobileMenu={() => setIsMobileMenuOpen(true)} onProfileClick={() => router.push("/settings")} />
        <SectionTabs current="withdraw-request" />

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A2E]">Withdrawals</h1>
            <p className="text-sm text-[#6B6B80] mt-1">Create payout batches and review flagged requests.</p>
          </div>
          <span className="text-xs font-semibold text-[#6B6B80] bg-[#F6F6FB] rounded-full px-3 py-1.5">PayPal API — Coming Soon</span>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-[#ECECF5]">
          {TABS.map((t) => (
            <button key={t.value} onClick={() => { setTab(t.value); setSelected([]); setReviewId(null); setNotice(""); }}
              className={`px-4 h-10 text-sm font-semibold cursor-pointer border-b-2 -mb-px ${
                tab === t.value ? "border-[#3E3EDF] text-[#3E3EDF]" : "border-transparent text-[#6B6B80]"
              }`}>
              {t.label} ({String(counts[t.value] ?? 0)})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4 items-start">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Selected Transactions", String(picked.length)],
              ["Shopper Payouts", money(payouts)],
              ["Estimated PayPal Fees", money(picked.length * fee)],
              ["Total Batch Cost", money(payouts + picked.length * fee)],
            ].map(([label, value]) => (
              <div key={label} className="bg-white border border-[#ECECF5] rounded-2xl p-4">
                <div className="text-xs text-[#6B6B80]">{label}</div>
                <div className="text-xl font-bold text-[#1A1A2E] mt-1">{value}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button disabled={busy || tab !== "ready" || picked.length === 0} onClick={() => void createBatch()}
                className="h-10 px-4 rounded-lg bg-[#3E3EDF] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">
                Create Batch
              </button>
              <button disabled={busy}
                onClick={() => void run(async () => setBatches(await nibblApi.payoutBatches()))}
                className="h-10 px-4 rounded-lg border border-[#3E3EDF]/40 text-[#3E3EDF] text-sm font-semibold disabled:opacity-50 cursor-pointer">
                Download PayPal File
              </button>
              <button disabled={busy} onClick={() => fileInput.current?.click()}
                className="h-10 px-4 rounded-lg border border-[#3E3EDF]/40 text-[#3E3EDF] text-sm font-semibold disabled:opacity-50 cursor-pointer">
                Import PayPal Results
              </button>
              <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void importResults(file);
                }} />
            </div>
            <p className="text-xs text-[#6B6B80]">Successful imports mark matching withdrawals Paid. Failed results move to Failed.</p>
          </div>
        </div>

        {notice && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-lg px-3 py-2">{notice}</div>}
        {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

        {batches && (
          <div className="bg-white border border-[#ECECF5] rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="font-semibold text-sm text-[#1A1A2E]">Payout batches</span>
              <button onClick={() => setBatches(null)} className="text-xs text-[#6B6B80] cursor-pointer">Close</button>
            </div>
            {batches.length === 0 && <span className="text-sm text-[#9A9AB0]">No batches yet.</span>}
            {batches.slice(0, 20).map((b) => (
              <div key={String(b.id)} className="flex flex-wrap items-center justify-between gap-2 text-sm border-t border-[#F6F6FB] pt-2">
                <span>Batch {String(b.id).slice(0, 8).toUpperCase()} · {when(b.created_at)} · {String(b.count)} withdrawals · {money(b.total_amount)} · <span className="capitalize">{String(b.status)}</span></span>
                <button onClick={() => void run(() => downloadBatchFile(String(b.id)))}
                  className="h-8 px-3 rounded-lg border border-[#3E3EDF]/40 text-[#3E3EDF] text-xs font-semibold cursor-pointer">
                  Download
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={`grid grid-cols-1 gap-4 items-start ${tab === "review" && reviewRow ? "xl:grid-cols-[1fr_380px]" : ""}`}>
          <div className="bg-white border border-[#ECECF5] rounded-2xl overflow-x-auto">
            <div className="p-3 border-b border-[#ECECF5]">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by withdrawal ID, shopper name, or email…"
                className="w-full h-10 px-3 rounded-lg border border-[#E0E0F0] text-sm outline-none focus:border-[#3E3EDF]" />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[#6B6B80] border-b border-[#ECECF5]">
                  {tab === "ready" && (
                    <th className="p-3 w-8">
                      <input type="checkbox" checked={rows.length > 0 && selected.length === rows.length}
                        onChange={(e) => setSelected(e.target.checked ? rows.map((r) => String(r.id)) : [])} />
                    </th>
                  )}
                  <th className="p-3 text-left">Withdrawal ID</th>
                  <th className="p-3 text-left">Shopper</th>
                  <th className="p-3 text-left">Method</th>
                  <th className="p-3 text-left">Amount</th>
                  <th className="p-3 text-left">Requested</th>
                  {tab === "completed" && <th className="p-3 text-left">Paid</th>}
                  {tab === "failed" && <th className="p-3 text-left">Failure</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const id = String(row.id);
                  return (
                    <tr key={id} onClick={() => tab === "review" && setReviewId(id)}
                      className={`border-b border-[#F6F6FB] ${tab === "review" ? "cursor-pointer hover:bg-[#F6F6FB]" : ""} ${
                        reviewRow && String(reviewRow.id) === id && tab === "review" ? "bg-[#F6F6FB]" : ""}`}>
                      {tab === "ready" && (
                        <td className="p-3">
                          <input type="checkbox" checked={selected.includes(id)}
                            onChange={() => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))} />
                        </td>
                      )}
                      <td className="p-3 font-semibold text-[#1A1A2E]" title={id}>{String(row.reference)}</td>
                      <td className="p-3">
                        <div className="text-[#1A1A2E]">{String(row.shopper_name || "—")}</div>
                        <div className="text-xs text-[#6B6B80]">{String(row.shopper_email)}</div>
                      </td>
                      <td className="p-3">{provider(row.provider)} <span className="text-xs text-[#6B6B80]">{String(row.handle)}</span></td>
                      <td className="p-3 font-semibold">{money(row.amount)}</td>
                      <td className="p-3 text-xs">{when(row.requested_at)}</td>
                      {tab === "completed" && (
                        <td className="p-3 text-xs">{when(row.paid_at)}{row.paypal_transaction_id ? ` · ${String(row.paypal_transaction_id)}` : ""}</td>
                      )}
                      {tab === "failed" && (
                        <td className="p-3 text-xs">
                          <div className="text-red-600">{String(row.failure_reason || "Failed")}</div>
                          {row.failure_permanent ? (
                            <div className="text-[#6B6B80]">Amount returned to the shopper&apos;s balance</div>
                          ) : (
                            <div className="flex gap-2 mt-1">
                              <button disabled={busy} onClick={() => void failedAction(row, "retry")}
                                className="h-7 px-3 rounded-full bg-[#3E3EDF] text-white font-semibold disabled:opacity-50 cursor-pointer">Retry</button>
                              <button disabled={busy} onClick={() => void failedAction(row, "return-funds")}
                                className="h-7 px-3 rounded-full border border-red-200 text-red-600 font-semibold disabled:opacity-50 cursor-pointer">Return to balance</button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {data && rows.length === 0 && (
                  <tr><td colSpan={8} className="p-10 text-center text-[#9A9AB0]">Nothing here.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {tab === "review" && reviewRow && (
            <ManualReviewPanel key={String(reviewRow.id)} row={reviewRow} onDone={(msg) => { setReviewId(null); reload(msg); }} />
          )}
        </div>
      </main>
    </div>
  );
};
