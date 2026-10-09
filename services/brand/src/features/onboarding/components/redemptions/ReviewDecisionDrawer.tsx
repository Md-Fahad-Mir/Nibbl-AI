/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { ApiRecord } from "@/lib/api/backendApi";
import { ReviewSelection, useBrandApiStore } from "@/stores/useBrandApiStore";

export const REJECTION_REASONS: { value: string; label: string }[] = [
  { value: "outside_period", label: "Purchase outside reservation period" },
  { value: "retailer_not_eligible", label: "Required retailer not eligible" },
  { value: "item_not_found", label: "Eligible item not found" },
  { value: "quantity_not_met", label: "Required quantity not met" },
  { value: "price_not_visible", label: "Price not visible" },
  { value: "unreadable", label: "Receipt unreadable after resubmission" },
  { value: "duplicate", label: "Duplicate receipt or previously allocated item" },
  { value: "final_resubmission", label: "Final resubmission rejected" },
];

const DEAL_LABELS: Record<string, string> = {
  free: "Free",
  bogo_free: "BOGO Free",
  bogo_half: "Buy 1, Get 1 50% Off",
  buy_x_get_y: "Buy X, Get $Y Off",
};

/** "Auto-approves in 2d 4h" — Master: every row shows its exact countdown. */
export const autoApproveCountdown = (deadline?: string) => {
  if (!deadline) return "";
  const ms = new Date(deadline).getTime() - Date.now();
  if (Number.isNaN(ms)) return "";
  if (ms <= 0) return "Auto-approving now";
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  return days > 0 ? `Auto-approves in ${days}d ${hours % 24}h` : `Auto-approves in ${hours}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
};

const money = (value: unknown) => {
  const n = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(n) ? "—" : `$${n.toFixed(2)}`;
};

interface LineState {
  checked: boolean;
  quantity: string;
  price: string;
}

interface ReviewDecisionDrawerProps {
  item: ApiRecord; // review-queue item from the API
  onClose: () => void;
  onApprove: (itemId: string, selection: ReviewSelection) => Promise<void>;
  onReject: (itemId: string, reasonCode: string, note: string) => Promise<void>;
}

export default function ReviewDecisionDrawer({ item, onClose, onApprove, onReject }: ReviewDecisionDrawerProps) {
  const previewReviewQueueItem = useBrandApiStore((state) => state.previewReviewQueueItem);
  const receipt = (item.receipt || {}) as ApiRecord;
  const terms = (item.locked_terms || {}) as ApiRecord;
  const products = (Array.isArray(terms.eligible_products) ? terms.eligible_products : []) as ApiRecord[];
  const lines = (Array.isArray(receipt.line_items) ? receipt.line_items : []) as ApiRecord[];
  const eligibleIds = products.map((p) => String(p.id));

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  // Lines the system already matched to an eligible product start selected.
  const [lineState, setLineState] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      lines.map((line) => [
        String(line.id),
        {
          checked: eligibleIds.includes(String(line.matched_product ?? "")),
          quantity: String(line.quantity ?? 1),
          price: line.unit_price != null ? String(line.unit_price) : "",
        },
      ])
    )
  );
  const [product, setProduct] = useState(
    String(lines.find((l) => eligibleIds.includes(String(l.matched_product ?? "")))?.matched_product ?? products[0]?.id ?? "")
  );
  const [saveAlias, setSaveAlias] = useState(false);
  const [reward, setReward] = useState<string | null>(null); // set after Confirm Mapping
  const [mode, setMode] = useState<"review" | "reject">("review");
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const imageUrl = String(receipt.image_url ?? "");
  const selection = (): ReviewSelection => ({
    lines: Object.entries(lineState)
      .filter(([, s]) => s.checked)
      .map(([id, s]) => ({
        line_item: id,
        quantity: Math.max(1, Number(s.quantity) || 1),
        unit_price: s.price.trim() === "" ? null : s.price.trim(),
      })),
    product,
    save_alias: saveAlias,
  });

  // Any change to the selection invalidates the calculated reward.
  const edit = (id: string, patch: Partial<LineState>) => {
    setLineState((cur) => ({ ...cur, [id]: { ...cur[id], ...patch } }));
    setReward(null);
  };

  const confirmMapping = async () => {
    setError("");
    if (!selection().lines.length) return setError("Select the receipt lines for the eligible purchase.");
    if (!product) return setError("Choose which eligible product these lines are.");
    setBusy(true);
    try {
      setReward(await previewReviewQueueItem(String(item.id), selection()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not calculate the reward.");
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    setBusy(true);
    setError("");
    try {
      await onApprove(String(item.id), selection());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve.");
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!reasonCode) return setError("Choose a rejection reason.");
    setBusy(true);
    setError("");
    try {
      await onReject(String(item.id), reasonCode, note.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject.");
      setBusy(false);
    }
  };

  const cell = "border border-[#E0E3F5] rounded-lg px-2 h-8 text-xs text-[#131B2E] w-20";

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-50" />
      <div className="fixed top-0 right-0 h-screen w-full max-w-[1000px] bg-[#FAF8FF] shadow-2xl z-50 flex flex-col md:flex-row font-manrope animate-slide-left">
        {/* ② Full receipt viewer */}
        <div className="w-full md:w-[420px] h-1/2 md:h-full bg-[#F2F3FF] border-r border-[#C5C5D9]/20 flex flex-col">
          <div className="h-16 border-b border-[#C5C5D9]/20 px-5 flex justify-between items-center bg-white">
            <span className="font-bold text-[#131B2E] text-sm">Submitted receipt</span>
            <div className="flex items-center gap-1.5">
              {[
                { t: "−", f: () => setZoom((z) => Math.max(z - 0.2, 0.6)) },
                { t: "+", f: () => setZoom((z) => Math.min(z + 0.2, 3)) },
                { t: "⟳", f: () => setRotation((r) => (r + 90) % 360) },
                { t: "1:1", f: () => { setZoom(1); setRotation(0); } },
              ].map((b) => (
                <button key={b.t} onClick={b.f} className="w-8 h-8 rounded-full bg-[#E2E7FF] text-[#001BD2] text-xs font-bold cursor-pointer">
                  {b.t}
                </button>
              ))}
              {imageUrl && (
                <a href={imageUrl} target="_blank" rel="noreferrer" download className="h-8 px-3 rounded-full bg-[#E2E7FF] text-[#001BD2] text-xs font-bold flex items-center">
                  Download
                </a>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Receipt"
                className="max-w-full rounded shadow-xl transition-transform origin-top"
                style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
              />
            ) : (
              <p className="text-sm text-[#64748B] mt-10">No receipt image (digital receipt).</p>
            )}
          </div>
        </div>

        <div className="flex-1 h-1/2 md:h-full flex flex-col bg-white min-w-0">
          <div className="h-16 px-6 flex justify-between items-center border-b border-[#C5C5D9]/15">
            <div>
              <span className="text-[10px] font-extrabold text-[#D97706] uppercase tracking-wider">
                Manual review · {autoApproveCountdown(String(item.deadline_at ?? ""))}
              </span>
              <h3 className="font-jakarta font-extrabold text-lg text-[#131B2E]">
                {String(receipt.user_name || "Customer")} · {String(receipt.user_email ?? "")}
              </h3>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-slate-50 cursor-pointer text-lg font-bold">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 text-left">
            <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              Approve or reject before the deadline ({item.deadline_at ? new Date(String(item.deadline_at)).toLocaleString() : "—"}). Otherwise the
              receipt is approved automatically at the maximum reward ({money(terms.max_reward)}).
            </p>

            {/* ③ Locked campaign requirements */}
            <section className="bg-[#F2F3FF] rounded-2xl p-4">
              <h4 className="text-xs font-bold text-[#454656] uppercase tracking-wider mb-2">Locked claim terms</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-[#131B2E]">
                <span>Offer: <b>{DEAL_LABELS[String(terms.deal_type)] ?? "Legacy offer"}</b></span>
                <span>Units required: <b>{String(terms.required_units ?? 1)}</b></span>
                <span>Maximum reward: <b>{money(terms.max_reward)}</b></span>
                <span>
                  Retailer:{" "}
                  <b>
                    {Array.isArray(terms.eligible_retailers) && terms.eligible_retailers.length
                      ? (terms.eligible_retailers as string[]).join(", ")
                      : "Any retailer"}
                  </b>
                </span>
                <span className="col-span-2">Products: <b>{products.map((p) => String(p.name)).join(", ") || "—"}</b></span>
                <span className="col-span-2 text-xs text-[#64748B]">
                  Claimed {terms.claimed_at ? new Date(String(terms.claimed_at)).toLocaleString() : "—"} · submitted{" "}
                  {receipt.created_at ? new Date(String(receipt.created_at)).toLocaleString() : "—"}. These terms can&apos;t be changed here.
                </span>
              </div>
            </section>

            {String(receipt.decision_reason ?? "") && (
              <p className="text-xs text-[#454656]">Why it&apos;s in review: {String(receipt.decision_reason)}</p>
            )}

            {mode === "review" ? (
              <>
                {/* ④ Select receipt lines */}
                <section>
                  <h4 className="text-xs font-bold text-[#454656] uppercase tracking-wider mb-2">Select the qualifying receipt lines</h4>
                  {lines.length === 0 ? (
                    <p className="text-sm text-[#64748B]">No lines were read from this receipt.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-[10px] text-[#64748B] uppercase text-left">
                        <tr>
                          <th className="py-1" />
                          <th className="py-1">Receipt line</th>
                          <th className="py-1">Qty</th>
                          <th className="py-1">Unit price ($)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => {
                          const id = String(line.id);
                          const s = lineState[id];
                          return (
                            <tr key={id} className={`border-t border-[#F1F2FA] ${s.checked ? "bg-[#F2F3FF]" : ""}`}>
                              <td className="py-2 pr-2">
                                <input type="checkbox" checked={s.checked} onChange={(e) => edit(id, { checked: e.target.checked })} />
                              </td>
                              <td className="py-2 pr-2 text-[#131B2E]">{String(line.description ?? "")}</td>
                              <td className="py-2 pr-2">
                                <input className={cell} type="number" min="1" value={s.quantity} disabled={!s.checked}
                                  onChange={(e) => edit(id, { quantity: e.target.value })} />
                              </td>
                              <td className="py-2">
                                <input className={cell} type="number" min="0" step="0.01" placeholder="unknown" value={s.price}
                                  disabled={!s.checked} onChange={(e) => edit(id, { price: e.target.value })} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  <p className="text-[11px] text-[#64748B] mt-1">Corrections to quantity or price are saved to the audit log.</p>
                </section>

                {/* ⑤ Confirm product mapping */}
                <section className="flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-[#454656] uppercase tracking-wider">Which eligible product is this?</h4>
                  <select
                    className="h-10 border border-[#E0E3F5] rounded-xl px-3 text-sm"
                    value={product}
                    onChange={(e) => {
                      setProduct(e.target.value);
                      setReward(null);
                    }}
                  >
                    {products.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {String(p.name)}
                      </option>
                    ))}
                  </select>
                  {/* ⑥ Optional alias — unchecked by default */}
                  <label className="flex items-start gap-2 text-xs text-[#454656]">
                    <input type="checkbox" className="mt-0.5" checked={saveAlias} onChange={(e) => setSaveAlias(e.target.checked)} />
                    <span>
                      <b>Save product alias.</b> Save this receipt wording as an alias for this product. Nibbl will recheck
                      matching pending claims and use it for future receipts.
                    </span>
                  </label>
                  <button
                    onClick={confirmMapping}
                    disabled={busy}
                    className="self-start h-10 px-5 rounded-full border border-[#001BD2] text-[#001BD2] text-sm font-bold disabled:opacity-50 cursor-pointer"
                  >
                    Confirm mapping &amp; calculate reward
                  </button>
                </section>

                {/* ⑦ Calculated reward */}
                <section className="bg-[#F2F3FF] rounded-2xl p-4 flex justify-between items-center">
                  <span className="text-sm font-bold text-[#131B2E]">Reward calculated by Nibbl</span>
                  <span className="text-xl font-extrabold text-[#001BD2]">{reward !== null ? money(reward) : "—"}</span>
                </section>
              </>
            ) : (
              <section className="flex flex-col gap-3">
                <h4 className="text-xs font-bold text-[#454656] uppercase tracking-wider">Rejection reason</h4>
                {REJECTION_REASONS.map((r) => (
                  <label key={r.value} className="flex items-center gap-2 text-sm text-[#131B2E]">
                    <input type="radio" name="reason" checked={reasonCode === r.value} onChange={() => setReasonCode(r.value)} />
                    {r.label}
                  </label>
                ))}
                <textarea
                  className="border border-[#E0E3F5] rounded-xl p-3 text-sm"
                  rows={2}
                  placeholder="Optional note for the customer"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </section>
            )}

            {error && <p className="text-sm font-semibold text-[#BA1A1A]">{error}</p>}
          </div>

          <div className="p-6 border-t border-[#C5C5D9]/15 flex gap-3">
            {mode === "review" ? (
              <>
                <button
                  onClick={approve}
                  disabled={busy || reward === null}
                  className="flex-1 h-12 bg-[#001BD2] hover:opacity-95 text-white font-extrabold text-sm rounded-full disabled:opacity-40 cursor-pointer"
                  title={reward === null ? "Confirm the mapping to calculate the reward first" : ""}
                >
                  ✓ Approve {reward !== null ? `· ${money(reward)}` : ""}
                </button>
                <button
                  onClick={() => { setMode("reject"); setError(""); }}
                  className="h-12 px-6 rounded-full border border-[#BA1A1A]/30 text-[#BA1A1A] font-bold text-sm cursor-pointer"
                >
                  Reject
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={reject}
                  disabled={busy}
                  className="flex-1 h-12 bg-[#BA1A1A] text-white font-extrabold text-sm rounded-full disabled:opacity-40 cursor-pointer"
                >
                  Reject receipt
                </button>
                <button onClick={() => { setMode("review"); setError(""); }} className="h-12 px-6 rounded-full border border-slate-300 text-sm font-bold cursor-pointer">
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
