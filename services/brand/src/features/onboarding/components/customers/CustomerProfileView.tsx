/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { CustomerData } from "./CustomerLedger";
import { customerInitials, formatDate, formatMoney } from "../../utils/backendMappers";

interface CustomerProfileViewProps {
  customer: CustomerData;
  onBack: () => void;
  onToggleSuspend: (c: CustomerData) => void;
  /** Bumped by the parent after a ban/unban so the profile reloads. */
  reloadKey?: number;
}

const card = "bg-white border border-[#EAEDFF] rounded-[20px] p-5";
const heading = "font-jakarta font-bold text-lg text-[#131B2E]";
const asList = (value: unknown) => (Array.isArray(value) ? (value as ApiRecord[]) : []);

const Tile = ({ label, value }: { label: string; value: string }) => (
  <div className="border border-[#F1F2FA] rounded-2xl p-4">
    <div className="text-xs text-[#64748B]">{label}</div>
    <div className="font-jakarta text-2xl font-extrabold text-[#131B2E] mt-1">{value}</div>
  </div>
);

const Badge = ({ on, text }: { on: boolean; text: string }) => (
  <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${on ? "bg-[#E2E7FF] text-[#001BD2]" : "bg-slate-100 text-slate-500"}`}>
    {on ? "●" : "○"} {text}
  </span>
);

/** Master "Customer Profile": relationship with the brand, Nibbl totals only,
 *  open claims, cooldowns (Remove), redemption history (full receipt 30 days,
 *  then the matching line) and recent activity. */
export default function CustomerProfileView({ customer, onBack, onToggleSuspend, reloadKey = 0 }: CustomerProfileViewProps) {
  const brandId = useBrandApiStore((s) => s.selectedBrandId) ?? "";
  const brand = useBrandApiStore((s) => s.brand);
  const [profile, setProfile] = useState<ApiRecord | null>(null);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<ApiRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const brandName = String(brand?.name ?? "your brand");

  const fetchProfile = useCallback(
    () => apiClient.request<ApiRecord>(backendApi.brand.customerProfile(brandId, customer.id)),
    [brandId, customer.id]
  );

  useEffect(() => {
    let live = true;
    fetchProfile()
      .then((data) => live && setProfile(data))
      .catch((err) => live && setError(err instanceof Error ? err.message : "Could not load this customer."));
    return () => {
      live = false;
    };
  }, [fetchProfile, reloadKey]);

  const removeCooldown = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      setProfile(await apiClient.request<ApiRecord>(backendApi.brand.removeCustomerCooldown(brandId, customer.id), {
        body: { kind: removing.kind, id: removing.id },
      }));
      setRemoving(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the cooldown.");
    } finally {
      setBusy(false);
    }
  };

  const rel = (profile?.relationship ?? {}) as ApiRecord;
  const site = (profile?.nibbl_activity ?? {}) as ApiRecord;
  const openClaims = asList(profile?.open_claims);
  const cooldowns = asList(profile?.cooldowns);
  const history = asList(profile?.redemption_history);
  const activity = asList(profile?.recent_activity);
  const banned = profile?.status === "banned";
  const pct = (v: unknown) => (v == null ? "—" : `${String(v)}%`);

  return (
    <div className="flex flex-col gap-6 w-full text-left font-manrope animate-slide-up">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-[#454656] hover:text-[#001BD2] cursor-pointer w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to Customers
      </button>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      {!profile ? (
        !error && <p className="text-sm text-[#64748B]">Loading customer…</p>
      ) : (
        <>
          <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
            <div className="flex items-center gap-4">
              <span className="w-16 h-16 rounded-full bg-[#E2E7FF] text-[#001BD2] font-extrabold text-xl flex items-center justify-center">
                {customerInitials(String(profile.name))}
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="font-jakarta text-2xl font-extrabold text-[#131B2E]">{String(profile.name)}</h2>
                <span className="text-sm text-[#454656]">
                  {[profile.email, profile.phone].filter(Boolean).map(String).join(" · ") || "Contact hidden on your plan"}
                </span>
                <span className="text-xs text-[#94A3B8]">
                  Customer since {formatDate(profile.customer_since) || "—"} · Last active {formatDate(profile.last_active) || "—"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge on={Boolean(profile.nibbl_opt_in)} text="Nibbl Opt-In" />
              <Badge on={Boolean(profile.brand_opt_in)} text={`${brandName} Opt-In`} />
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${banned ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                ● {banned ? "Banned" : "Active"}
              </span>
              <button onClick={() => onToggleSuspend({ ...customer, status: banned ? "Suspended" : "Active" })}
                disabled={!customer.canSuspend}
                className={`h-10 px-4 rounded-xl text-sm font-bold border cursor-pointer disabled:opacity-50 ${
                  banned ? "border-[#001BD2]/40 text-[#001BD2]" : "border-red-300 text-red-600"
                }`}>
                {banned ? "Lift Ban" : "⊘ Ban Customer"}
              </button>
            </div>
            {banned && Boolean(profile.ban_reason) && (
              <p className="w-full text-xs text-red-700">Ban reason: {String(profile.ban_reason)}. Existing claims remain valid.</p>
            )}
          </div>

          <section className="flex flex-col gap-3">
            <h3 className={heading}>Relationship with {brandName}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Tile label="Claims" value={String(rel.claims ?? 0)} />
              <Tile label="Completed Rebates" value={String(rel.completed_rebates ?? 0)} />
              <Tile label="Brand Conversion" value={pct(rel.conversion)} />
              <Tile label="Brand Rewards" value={formatMoney(rel.rewards ?? 0)} />
              <Tile label="Brand Reviews" value={String(rel.reviews ?? 0)} />
              <Tile label="Open Claims" value={String(rel.open_claims ?? 0)} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className={heading}>Nibbl Activity — Totals Only</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Tile label="Total Claims" value={String(site.total_claims ?? 0)} />
              <Tile label="Overall Completion" value={pct(site.completion)} />
              <Tile label="Total Reviews" value={String(site.total_reviews ?? 0)} />
              <Tile label="Total Rewards" value={formatMoney(site.total_rewards ?? 0)} />
            </div>
            <p className="text-xs text-[#64748B]">ⓘ Other brands, products, receipts, and review content are never shown.</p>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className={`${card} flex flex-col gap-3`}>
              <h3 className={heading}>Open Claims ({openClaims.length})</h3>
              {openClaims.length === 0 && <p className="text-sm text-[#94A3B8]">No open claims.</p>}
              {openClaims.map((c) => (
                <div key={String(c.id)} className="flex items-center gap-3">
                  {c.image ? <img src={String(c.image)} alt="" className="w-12 h-12 rounded-lg object-cover" /> : null}
                  <div className="flex-1">
                    <div className="text-sm font-bold text-[#131B2E]">{String(c.offer)}</div>
                    <div className="text-xs text-[#64748B]">Claimed {formatDate(c.claimed_at)} · Expires {formatDate(c.expires_at)}</div>
                  </div>
                  <span className="text-[11px] font-bold text-red-600 bg-red-50 rounded-full px-2 py-1">{String(c.days_left)} days left</span>
                </div>
              ))}
            </section>
            <section className={`${card} flex flex-col gap-3`}>
              <h3 className={heading}>Cooldowns ({cooldowns.length})</h3>
              {cooldowns.length === 0 && <p className="text-sm text-[#94A3B8]">No active cooldowns.</p>}
              {cooldowns.map((c) => (
                <div key={`${String(c.kind)}-${String(c.id)}`} className="flex items-center gap-3">
                  {c.image ? <img src={String(c.image)} alt="" className="w-12 h-12 rounded-lg object-cover" /> : null}
                  <div className="flex-1">
                    <div className="text-sm font-bold text-[#131B2E]">{String(c.name)}</div>
                    <div className="text-xs text-[#64748B]">{c.kind === "review" ? "Review cooldown" : "Rebate cooldown"}</div>
                  </div>
                  <span className="text-[11px] font-bold text-red-600 bg-red-50 rounded-full px-2 py-1">
                    {c.one_time ? "One time" : `${String(c.days_left)} days left`}
                  </span>
                  <button onClick={() => setRemoving(c)}
                    className="h-8 px-3 rounded-lg border border-[#001BD2]/40 text-[#001BD2] text-xs font-bold cursor-pointer">Remove</button>
                </div>
              ))}
              <p className="text-xs text-[#64748B]">ⓘ Removing a cooldown requires confirmation and is audit logged.</p>
            </section>
          </div>

          <section className={`${card} flex flex-col gap-3`}>
            <h3 className={heading}>Redemption History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-[#64748B] border-b border-[#F1F2FA]">
                    <th className="py-2 text-left">Campaign / Product</th><th className="py-2 text-left">Retailer</th>
                    <th className="py-2 text-left">Submitted</th><th className="py-2 text-left">Reward</th>
                    <th className="py-2 text-left">Status</th><th className="py-2 text-left">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => {
                    const lines = asList(h.matching_lines);
                    return (
                      <tr key={String(h.id)} className="border-b border-[#F8F9FF] align-top">
                        <td className="py-2"><div className="font-bold text-[#131B2E]">{String(h.offer)}</div><div className="text-xs text-[#64748B]">{String(h.product)}</div></td>
                        <td className="py-2">{String(h.retailer || "—")}</td>
                        <td className="py-2">{formatDate(h.submitted_at)}</td>
                        <td className="py-2">{h.reward ? formatMoney(h.reward) : "—"}</td>
                        <td className="py-2 capitalize">{String(h.status).replace("_", " ")}</td>
                        <td className="py-2 text-xs">
                          {h.receipt_image ? (
                            <>
                              <a href={String(h.receipt_image)} target="_blank" rel="noreferrer" className="font-bold text-[#001BD2]">View receipt</a>
                              <span className="text-[#64748B]"> · {String(h.full_receipt_days_left)} days left</span>
                            </>
                          ) : (
                            <span className="text-[#64748B]">
                              Matching line only{lines.length ? `: ${lines.map((l) => String(l.description)).join(", ")}` : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {history.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-[#94A3B8]">No receipts yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[#64748B]">ⓘ Full receipts are available for 30 days. After 30 days, only the matching line item and required receipt details remain.</p>
          </section>

          <section className={`${card} flex flex-col gap-2`}>
            <h3 className={heading}>Recent Activity</h3>
            {activity.length === 0 && <p className="text-sm text-[#94A3B8]">No activity yet.</p>}
            {activity.map((a, i) => (
              <div key={i} className="flex gap-4 text-sm">
                <span className="w-28 text-[#64748B]">{formatDate(a.at)}</span>
                <span className="text-[#131B2E]">{String(a.text)}</span>
              </div>
            ))}
          </section>
        </>
      )}

      {removing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRemoving(null)}>
          <div className="w-full max-w-[400px] bg-white rounded-[24px] p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-jakarta font-extrabold text-lg text-[#131B2E]">
              Remove {removing.kind === "review" ? "review" : "rebate"} cooldown?
            </h3>
            <p className="text-sm text-[#454656]">
              {String(profile?.name ?? "This customer")} will become eligible for {removing.kind === "review" ? "reviewing this product" : "this campaign"} again.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRemoving(null)} className="h-10 px-5 rounded-full border border-slate-200 text-sm font-bold text-[#454656] cursor-pointer">Cancel</button>
              <button onClick={() => void removeCooldown()} disabled={busy}
                className="h-10 px-5 rounded-full bg-[#001BD2] text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
                {busy ? "Removing…" : "Remove Cooldown"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
