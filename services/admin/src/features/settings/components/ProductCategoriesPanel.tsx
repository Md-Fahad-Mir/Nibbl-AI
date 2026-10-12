"use client";

import { useEffect, useState } from "react";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";

/** Master Product Library #6: standardized, admin-managed categories; brands
 *  request additions here. */
export const ProductCategoriesPanel = () => {
  const [data, setData] = useState<ApiRecord | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    nibblApi
      .adminProductCategories()
      .then((result) => live && setData(result))
      .catch((err: Error) => live && setError(err.message || "Could not load categories."));
    return () => {
      live = false;
    };
  }, []);

  const run = async (action: () => Promise<ApiRecord>) => {
    setBusy(true);
    setError("");
    try {
      setData(await action());
      return true;
    } catch (err) {
      setError((err as Error).message || "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const categories = (Array.isArray(data?.categories) ? data.categories : []) as ApiRecord[];
  const requests = (Array.isArray(data?.requests) ? data.requests : []) as ApiRecord[];
  const pending = requests.filter((r) => r.status === "pending");

  return (
    <div className="bg-white border border-[#ECECF5] rounded-2xl p-6 shadow-sm flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-[#1A1A2E]">Product Categories</h3>
        <p className="text-sm text-[#6B6B80] mt-1">Brands choose from this list. Hiding a category keeps it on existing products.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {pending.length > 0 && (
        <div className="border border-amber-200 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-[#1A1A2E]">Brand requests ({pending.length})</p>
          {pending.map((r) => (
            <div key={String(r.id)} className="flex flex-col gap-2 border-b border-[#F6F6FB] pb-3">
              <span className="text-sm"><b>{String(r.name)}</b> · requested by {String(r.brand)}{r.note ? ` — “${String(r.note)}”` : ""}</span>
              <div className="flex flex-wrap gap-2">
                <input value={notes[String(r.id)] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [String(r.id)]: e.target.value }))}
                  placeholder="Reason (required to reject)" className="flex-1 min-w-48 h-9 px-3 rounded-lg border border-[#E0E0F0] text-sm" />
                <button disabled={busy} onClick={() => void run(() => nibblApi.adminDecideCategoryRequest(String(r.id), "approve", notes[String(r.id)] ?? ""))}
                  className="h-9 px-4 rounded-lg bg-[#3E3EDF] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">Approve</button>
                <button disabled={busy} onClick={() => void run(() => nibblApi.adminDecideCategoryRequest(String(r.id), "reject", notes[String(r.id)] ?? ""))}
                  className="h-9 px-4 rounded-lg border border-red-200 text-red-600 text-sm font-semibold disabled:opacity-50 cursor-pointer">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); void run(() => nibblApi.adminAddProductCategory(name)).then((ok) => ok && setName("")); }}
        className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category"
          className="flex-1 h-10 px-3 rounded-lg border border-[#E0E0F0] text-sm" />
        <button type="submit" disabled={busy || !name.trim()}
          className="h-10 px-4 rounded-lg bg-[#3E3EDF] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">Add</button>
      </form>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {categories.map((c) => (
          <li key={String(c.id)} className={`flex items-center justify-between gap-2 border border-[#ECECF5] rounded-lg px-3 py-2 text-sm ${c.is_active ? "" : "opacity-60"}`}>
            <span>{String(c.name)} <span className="text-xs text-[#9A9AB0]">· {String(c.products)} products</span></span>
            <button disabled={busy} onClick={() => void run(() => nibblApi.adminSetCategoryActive(String(c.id), !c.is_active))}
              className="text-xs font-semibold text-[#3E3EDF] cursor-pointer">{c.is_active ? "Hide" : "Restore"}</button>
          </li>
        ))}
      </ul>
    </div>
  );
};
