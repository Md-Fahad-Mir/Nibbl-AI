"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";
import { AdminPage, Notice, Pager, btn, money, selectCls, shortDate, usePaged } from "@/features/dashboard/components/AdminPage";

const TABS = ["Overview", "Wallet Ledger", "Claims & Reviews", "Referrals", "Suspensions"] as const;
type Tab = (typeof TABS)[number];
const list = (value: unknown) => (Array.isArray(value) ? (value as ApiRecord[]) : []);
const card = "bg-white border border-[#ECECF5] rounded-2xl p-4";
const Status = ({ value }: { value: unknown }) => (
  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
    value === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{String(value)}</span>
);

type Dialog = { kind: "wallet" | "note" | "suspend" | "cancel"; claimId?: string } | null;

/** Master Admin Sheet 3 "Shoppers": searchable list + selected shopper with
 *  activity tabs, purchase relationships, cooldowns and admin actions. */
export const ShoppersView = () => {
  const initial = useSearchParams().get("shopper") || "";
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<ApiRecord[] | null>(null);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState(initial);
  const [detail, setDetail] = useState<ApiRecord | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [form, setForm] = useState({ direction: "credit", amount: "", text: "" });
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      nibblApi
        .adminShoppers({ q, status, page: String(page), page_size: "10" })
        .then((result) => {
          if (!live) return;
          setRows(list(result.results));
          setCount(Number(result.count ?? 0));
        })
        .catch((err: Error) => live && setError(err.message || "Could not load shoppers."));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, status, page, reloadKey]);

  useEffect(() => {
    if (!selected) return;
    let live = true;
    nibblApi
      .adminShopper(selected)
      .then((result) => live && setDetail(result))
      .catch((err: Error) => live && setError(err.message || "Could not load the shopper."));
    return () => {
      live = false;
    };
  }, [selected, reloadKey]);

  const open = (kind: NonNullable<Dialog>["kind"], claimId?: string) => {
    setForm({ direction: "credit", amount: "", text: "" });
    setError("");
    setDialog({ kind, claimId });
  };

  const submit = async () => {
    if (!dialog || !detail) return;
    setBusy(true);
    setError("");
    try {
      const id = String(detail.id);
      if (dialog.kind === "wallet") {
        await nibblApi.adminShopperWalletAdjust(id, { direction: form.direction, amount: form.amount, reason: form.text });
        setNotice("Wallet adjusted.");
      } else if (dialog.kind === "note") {
        await nibblApi.adminShopperNote(id, form.text);
        setNotice("Internal note added.");
      } else if (dialog.kind === "suspend") {
        const suspend = detail.status === "active";
        await nibblApi.adminShopperSuspend(id, suspend, form.text);
        setNotice(suspend ? "Shopper globally suspended." : "Shopper reactivated.");
      } else if (dialog.claimId) {
        await nibblApi.adminCancelReservation(dialog.claimId, form.text);
        setNotice("Claim cancelled and the brand's reserved funds returned.");
      }
      setDialog(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message || "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const ledgerPage = usePaged(list(detail?.ledger));
  const claimsPage = usePaged(list(detail?.claims));
  const reviewsPage = usePaged(list(detail?.reviews));
  const account = (detail?.account ?? {}) as ApiRecord;
  const wallet = (detail?.wallet ?? {}) as ApiRecord;
  const purchases = (detail?.purchase_activity ?? {}) as ApiRecord;
  const active = detail?.status === "active";

  return (
    <AdminPage active="users" title="Shoppers" subtitle="View account activity, Wallet history and purchase relationships.">
      <Notice error={dialog ? "" : error} notice={notice} />
      <div className="flex flex-col 2xl:flex-row gap-5 items-start">
        <section className="w-full 2xl:w-[52%] bg-white border border-[#ECECF5] rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search shoppers by name, email or ID"
              className="h-9 px-4 rounded-full border border-[#E0E0F0] text-xs flex-1 min-w-48" />
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#9A9AB0] border-b border-[#ECECF5] uppercase">
                  <th className="py-2 pr-3">Shopper</th><th className="py-2 pr-3">Account status</th>
                  <th className="py-2 pr-3 text-right">Wallet</th><th className="py-2 pr-3 text-right">Redemptions</th>
                  <th className="py-2 pr-3 text-right">Referrals</th><th className="py-2 pr-3 text-right">Brand suspensions</th>
                  <th className="py-2">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r) => (
                  <tr key={String(r.id)} onClick={() => { setSelected(String(r.id)); setTab("Overview"); setNotice(""); }}
                    className={`border-b border-[#F6F6FB] cursor-pointer ${selected === r.id ? "bg-[#F2F3FF]" : "hover:bg-[#FAFAFE]"}`}>
                    <td className="py-2 pr-3"><div className="font-semibold text-[#1A1A2E]">{String(r.name)}</div><div className="text-xs text-[#9A9AB0]">{String(r.email)}</div></td>
                    <td className="py-2 pr-3"><Status value={r.status} /></td>
                    <td className="py-2 pr-3 text-right">{money(r.wallet)}</td>
                    <td className="py-2 pr-3 text-right">{String(r.redemptions)}</td>
                    <td className="py-2 pr-3 text-right">{String(r.referrals)}</td>
                    <td className="py-2 pr-3 text-right">{String(r.brand_suspensions)}</td>
                    <td className="py-2 text-xs text-[#6B6B80]">{shortDate(r.last_activity)}</td>
                  </tr>
                ))}
                {rows && rows.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-[#9A9AB0]">No shoppers match.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager paged={{ page, pages: Math.max(1, Math.ceil(count / 10)), total: count, size: 10, setPage }} noun="shoppers" />
        </section>

        {selected && detail && (
          <section className="w-full 2xl:flex-1 min-w-0 flex flex-col gap-4">
            <div className="bg-white border border-[#ECECF5] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#1A1A2E]">{String(detail.name)}</h2>
                  <Status value={detail.status} />
                </div>
                <p className="text-xs text-[#6B6B80]">Shopper ID: {String(detail.shopper_id)} · Joined {shortDate(detail.joined)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => open("wallet")} className={`${btn} border border-[#3E3EDF]/40 text-[#3E3EDF]`}>Adjust Wallet</button>
                <button onClick={() => open("note")} className={`${btn} border border-[#3E3EDF]/40 text-[#3E3EDF]`}>Add Internal Note</button>
                <button onClick={() => open("suspend")}
                  className={`${btn} border ${active ? "border-red-300 text-red-600" : "border-emerald-300 text-emerald-700"}`}>
                  {active ? "Global Suspend" : "Reactivate"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`h-9 px-4 rounded-full text-xs font-semibold cursor-pointer ${
                  tab === t ? "bg-[#3E3EDF] text-white" : "bg-[#F6F6FB] text-[#454656]"}`}>{t}</button>
              ))}
            </div>

            {tab === "Overview" && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className={card}>
                    <h3 className="text-sm font-bold mb-2">Account &amp; Payout</h3>
                    <dl className="text-sm flex flex-col gap-1.5">
                      <div className="flex justify-between gap-2"><dt className="text-[#6B6B80]">Email</dt><dd className="truncate">{String(account.email)}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-[#6B6B80]">Phone</dt><dd>{String(account.phone || "—")}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-[#6B6B80]">SMS verified</dt><dd>{account.sms_verified ? "Yes" : "No"}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-[#6B6B80]">Payout identity</dt>
                        <dd className="truncate">{String(account.payout_identity || "—")}{account.payout_locked ? " · Locked" : ""}</dd></div>
                    </dl>
                  </div>
                  <div className={card}>
                    <h3 className="text-sm font-bold mb-2">Wallet</h3>
                    <div className="text-xs text-[#6B6B80]">Available balance</div><div className="text-xl font-bold">{money(wallet.available)}</div>
                    <div className="text-xs text-[#6B6B80] mt-2">Pending approval</div><div className="font-semibold">{money(wallet.pending_approval)}</div>
                    <div className="text-xs text-[#6B6B80] mt-2">Lifetime paid</div><div className="font-semibold">{money(wallet.lifetime_paid)}</div>
                  </div>
                  <div className={card}>
                    <h3 className="text-sm font-bold mb-2">Purchase Activity</h3>
                    <div className="text-xs text-[#6B6B80]">Brands purchased</div>
                    {list(purchases.brands).map((b) => <div key={String(b.name)} className="flex justify-between text-sm"><span>{String(b.name)}</span><span>{String(b.purchases)} purchases</span></div>)}
                    {list(purchases.brands).length === 0 && <div className="text-sm text-[#9A9AB0]">None yet</div>}
                    <div className="text-xs text-[#6B6B80] mt-2">Retailers used</div>
                    {list(purchases.retailers).map((r) => <div key={String(r.name)} className="flex justify-between text-sm"><span>{String(r.name)}</span><span>{String(r.purchases)} purchases</span></div>)}
                    {list(purchases.retailers).length === 0 && <div className="text-sm text-[#9A9AB0]">None yet</div>}
                  </div>
                </div>
                <div className={card}>
                  <h3 className="text-sm font-bold mb-2">Active Cooldowns</h3>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-[#9A9AB0]"><th className="py-1">Brand</th><th className="py-1">Campaign</th><th className="py-1">Ends</th></tr></thead>
                    <tbody>
                      {list(detail.cooldowns).map((c, i) => (
                        <tr key={i}><td className="py-1">{String(c.brand)}</td><td className="py-1">{String(c.campaign)}</td><td className="py-1">{shortDate(c.ends_at)}</td></tr>
                      ))}
                      {list(detail.cooldowns).length === 0 && <tr><td colSpan={3} className="py-2 text-[#9A9AB0]">No active cooldowns.</td></tr>}
                    </tbody>
                  </table>
                </div>
                {list(detail.notes).length > 0 && (
                  <div className={card}>
                    <h3 className="text-sm font-bold mb-2">Internal Notes</h3>
                    {list(detail.notes).map((n) => (
                      <div key={String(n.id)} className="text-sm border-b border-[#F6F6FB] py-2">
                        <div>{String(n.body)}</div>
                        <div className="text-xs text-[#9A9AB0]">{String(n.author)} · {shortDate(n.created_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "Wallet Ledger" && (
              <div className={`${card} overflow-x-auto`}>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-[#9A9AB0] border-b border-[#ECECF5]">
                    <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Description</th>
                    <th className="py-2 pr-3 text-right">Amount</th><th className="py-2 text-right">Balance</th></tr></thead>
                  <tbody>
                    {ledgerPage.items.map((e) => (
                      <tr key={String(e.id)} className="border-b border-[#F6F6FB]">
                        <td className="py-2 pr-3 text-xs">{shortDate(e.date)}</td><td className="py-2 pr-3">{String(e.category)}</td>
                        <td className="py-2 pr-3 text-xs text-[#6B6B80]">{String(e.description || "—")}</td>
                        <td className={`py-2 pr-3 text-right font-semibold ${e.type === "credit" ? "text-emerald-700" : "text-red-600"}`}>
                          {e.type === "credit" ? "+" : "−"}{money(e.amount)}</td>
                        <td className="py-2 text-right">{money(e.balance_after)}</td>
                      </tr>
                    ))}
                    {list(detail.ledger).length === 0 && <tr><td colSpan={5} className="py-4 text-center text-[#9A9AB0]">No wallet activity.</td></tr>}
                  </tbody>
                </table>
                <Pager paged={ledgerPage} noun="entries" />
              </div>
            )}

            {tab === "Claims & Reviews" && (
              <>
                <div className={`${card} overflow-x-auto`}>
                  <h3 className="text-sm font-bold mb-2">Claims</h3>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-[#9A9AB0] border-b border-[#ECECF5]">
                      <th className="py-2 pr-3">Campaign</th><th className="py-2 pr-3">Brand</th><th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Claimed</th><th className="py-2 pr-3">Expires</th><th className="py-2" /></tr></thead>
                    <tbody>
                      {claimsPage.items.map((c) => (
                        <tr key={String(c.id)} className="border-b border-[#F6F6FB]">
                          <td className="py-2 pr-3">{String(c.campaign)}</td><td className="py-2 pr-3">{String(c.brand)}</td>
                          <td className="py-2 pr-3 capitalize">{String(c.status)}</td>
                          <td className="py-2 pr-3 text-xs">{shortDate(c.claimed_at)}</td><td className="py-2 pr-3 text-xs">{shortDate(c.expires_at)}</td>
                          <td className="py-2 text-right">
                            {Boolean(c.can_cancel) && (
                              <button onClick={() => open("cancel", String(c.id))} className="text-xs font-semibold text-red-600 cursor-pointer">Cancel claim</button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {list(detail.claims).length === 0 && <tr><td colSpan={6} className="py-4 text-center text-[#9A9AB0]">No claims.</td></tr>}
                    </tbody>
                  </table>
                  <Pager paged={claimsPage} noun="claims" />
                </div>
                <div className={`${card} overflow-x-auto`}>
                  <h3 className="text-sm font-bold mb-2">Reviews</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {reviewsPage.items.map((r) => (
                        <tr key={String(r.id)} className="border-b border-[#F6F6FB]">
                          <td className="py-2 pr-3">{String(r.product)}</td><td className="py-2 pr-3">{String(r.brand)}</td>
                          <td className="py-2 pr-3">{"★".repeat(Number(r.rating))}</td>
                          <td className="py-2 pr-3 capitalize">{String(r.status)}</td><td className="py-2 text-xs">{shortDate(r.created_at)}</td>
                        </tr>
                      ))}
                      {list(detail.reviews).length === 0 && <tr><td className="py-4 text-center text-[#9A9AB0]">No reviews.</td></tr>}
                    </tbody>
                  </table>
                  <Pager paged={reviewsPage} noun="reviews" />
                </div>
              </>
            )}

            {tab === "Referrals" && (
              <div className={card}>
                {list(detail.referrals).map((r) => (
                  <div key={String(r.id)} className="flex justify-between gap-3 text-sm border-b border-[#F6F6FB] py-2">
                    <span>{String(r.new_shopper)}{r.flag_reason ? <span className="text-xs text-red-600"> · {String(r.flag_reason)}</span> : null}</span>
                    <span className="capitalize text-[#6B6B80]">{String(r.status).replace("_", " ")} · {shortDate(r.created_at)}</span>
                  </div>
                ))}
                {list(detail.referrals).length === 0 && <p className="text-sm text-[#9A9AB0]">No referrals.</p>}
              </div>
            )}

            {tab === "Suspensions" && (
              <div className={card}>
                {list(detail.suspensions).map((s) => (
                  <div key={String(s.id)} className="flex justify-between gap-3 text-sm border-b border-[#F6F6FB] py-2">
                    <span><b>{String(s.brand)}</b> · {String(s.reason || "No reason given")}</span>
                    <span className="text-[#6B6B80]">{s.active ? "Active" : "Removed"} · {shortDate(s.date)}</span>
                  </div>
                ))}
                {list(detail.suspensions).length === 0 && <p className="text-sm text-[#9A9AB0]">No brand suspensions.</p>}
              </div>
            )}
          </section>
        )}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && setDialog(null)}>
          <div className="w-full max-w-[420px] bg-white rounded-2xl p-6 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1A1A2E]">
              {{ wallet: "Adjust Wallet", note: "Add Internal Note", suspend: active ? "Global Suspend" : "Reactivate Shopper", cancel: "Cancel Claim" }[dialog.kind]}
            </h3>
            {dialog.kind === "wallet" && (
              <div className="flex gap-2">
                <select value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))} className="h-10 px-3 rounded-lg border border-[#E0E0F0] text-sm">
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                </select>
                <input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Amount (USD)"
                  inputMode="decimal" className="h-10 px-3 rounded-lg border border-[#E0E0F0] text-sm flex-1" />
              </div>
            )}
            <textarea value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} rows={3}
              placeholder={{ wallet: "Reason (required, kept in the ledger)", note: "Note (internal only)",
                suspend: "Reason", cancel: "Reason (required, audit-logged)" }[dialog.kind]}
              className="px-3 py-2 rounded-lg border border-[#E0E0F0] text-sm" />
            {dialog.kind === "cancel" && <p className="text-xs text-[#6B6B80]">The claim closes and the brand&apos;s reserved funds are returned.</p>}
            {dialog.kind === "suspend" && active && <p className="text-xs text-[#6B6B80]">The shopper can no longer sign in or claim offers on Nibbl.</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDialog(null)} disabled={busy} className={`${btn} border border-[#E0E0F0]`}>Close</button>
              <button onClick={() => void submit()} disabled={busy}
                className={`${btn} text-white ${dialog.kind === "suspend" && active || dialog.kind === "cancel" ? "bg-red-600" : "bg-[#3E3EDF]"}`}>
                {busy ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
};
