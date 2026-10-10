"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/features/dashboard/components/Sidebar";
import { Header } from "@/features/dashboard/components/Header";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useAdminApiStore } from "@/stores/useAdminApiStore";
import { ApiRecord, API_BASE_URL, nibblApi, tokenStorage } from "@/lib/api/backendApi";

const inputClass = "h-10 px-3 rounded-lg border border-[#E0E0F0] text-sm text-[#1A1A2E] outline-none focus:border-[#3E3EDF]";

const Tile = ({ label, value }: { label: string; value: unknown }) => (
  <div className="bg-white border border-[#ECECF5] rounded-2xl p-5">
    <div className="text-xs font-semibold uppercase tracking-wider text-[#9A9AB0]">{label}</div>
    <div className="text-2xl font-bold text-[#1A1A2E] mt-1">{String(value ?? "—")}</div>
  </div>
);

const list = (value: unknown) => (Array.isArray(value) ? value.map(String).join(", ") : "") || "—";

/** Master Admin Sheet 4: brands already on verified shopper receipts that
 *  aren't Nibbl partners, as sales leads (no shopper identities). */
export const BrandDiscoveryView = () => {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { profile, loadProfile, logout } = useAdminApiStore();
  const [filters, setFilters] = useState({ from: "", to: "", brand: "", category: "", retailer: "", state: "" });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<ApiRecord | null>(null);
  const [selected, setSelected] = useState<ApiRecord | null>(null);
  const [rename, setRename] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    let live = true;
    nibblApi
      .adminBrandDiscovery(applied)
      .then((result) => live && (setData(result), setError("")))
      .catch((err: Error) => live && setError(err.message || "Could not load brand discovery."));
    return () => {
      live = false;
    };
  }, [applied, reloadKey]);

  const handleNavSelect = (item: SidebarNavItem) => {
    if (item === "logout") {
      logout();
      router.push("/");
      return;
    }
    router.push(`/${item}`);
  };

  const openLead = async (lead: ApiRecord) => {
    setNotice("");
    try {
      const insight = await nibblApi.adminBrandDiscoveryInsight(String(lead.brand), applied);
      setSelected(insight);
      setRename(String(insight.brand));
    } catch (err) {
      setError((err as Error).message || "Could not load that brand.");
    }
  };

  const saveRule = async (ignored: boolean) => {
    if (!selected) return;
    try {
      for (const token of (selected.tokens as string[]) ?? []) {
        await nibblApi.setBrandDiscoveryRule(token, { display_name: ignored ? "" : rename.trim(), ignored });
      }
      setNotice(ignored ? `${String(selected.brand)} will no longer appear as a lead.` : "Brand name saved.");
      setSelected(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message || "Could not save.");
    }
  };

  const exportCsv = async () => {
    const query = new URLSearchParams({ ...Object.fromEntries(Object.entries(applied).filter(([, v]) => v)), export: "csv" });
    const token = tokenStorage.getAccess();
    const response = await fetch(`${API_BASE_URL}/admin/brand-discovery/?${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) return setError("Could not export leads.");
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "brand-discovery-leads.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const summary = (data?.summary ?? {}) as ApiRecord;
  const leads = (Array.isArray(data?.leads) ? data.leads : []) as ApiRecord[];

  return (
    <div className="flex min-h-screen w-full bg-[#FEFEFE]">
      <Sidebar activeNav="brand-discovery" onNavSelect={handleNavSelect} isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)} />
      <main className="flex-1 w-full min-h-screen p-4 sm:p-6 md:p-8 flex flex-col gap-6 items-stretch bg-[#FEFEFE] overflow-x-hidden font-inter">
        <Header adminName={String(profile?.full_name || profile?.email || "Admin")} adminRole={String(profile?.role || "Admin")}
          unreadCount={0} onToggleMobileMenu={() => setIsMobileMenuOpen(true)} onProfileClick={() => router.push("/settings")} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A2E]">Receipt Brand Discovery</h1>
            <p className="text-sm text-[#6B6B80] mt-1">
              Brands already on verified shopper receipts that aren&apos;t on Nibbl yet. Shopper identities are never shown.
            </p>
          </div>
          <button onClick={() => void exportCsv()} className="h-10 px-5 rounded-full bg-[#3E3EDF] text-white text-sm font-semibold cursor-pointer">
            Export leads
          </button>
        </div>

        {notice && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-lg px-3 py-2">{notice}</div>}
        {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Tile label="Unpartnered brands" value={summary.unpartnered_brands} />
          <Tile label="Verified receipts" value={summary.verified_receipts} />
          <Tile label="Participating retailers" value={summary.participating_retailers} />
        </div>

        <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => { e.preventDefault(); setApplied(filters); }}>
          <input type="date" aria-label="From" className={inputClass} value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <input type="date" aria-label="To" className={inputClass} value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          <input placeholder="Brand" className={inputClass} value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value })} />
          <input placeholder="Category" className={inputClass} value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} />
          <input placeholder="Retailer" className={inputClass} value={filters.retailer} onChange={(e) => setFilters({ ...filters, retailer: e.target.value })} />
          <input placeholder="State (e.g. CA)" maxLength={2} className={`${inputClass} w-32 uppercase`} value={filters.state} onChange={(e) => setFilters({ ...filters, state: e.target.value })} />
          <button type="submit" className="h-10 px-5 rounded-full border border-[#3E3EDF] text-[#3E3EDF] text-sm font-semibold cursor-pointer">Apply</button>
        </form>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          <div className="bg-white border border-[#ECECF5] rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#9A9AB0] border-b border-[#ECECF5]">
                  <th className="p-3">Brand</th>
                  <th className="p-3">Product text</th>
                  <th className="p-3">Retailers</th>
                  <th className="p-3">States</th>
                  <th className="p-3 text-right">Shoppers</th>
                  <th className="p-3 text-right">Receipts</th>
                  <th className="p-3 text-right">Repeat</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={String(lead.brand)} onClick={() => void openLead(lead)}
                    className={`border-b border-[#F6F6FB] cursor-pointer hover:bg-[#F6F6FB] ${selected?.brand === lead.brand ? "bg-[#F6F6FB]" : ""}`}>
                    <td className="p-3 font-semibold text-[#1A1A2E]">{String(lead.brand)}</td>
                    <td className="p-3 text-[#454656] max-w-[240px] truncate">{list(lead.product_texts)}</td>
                    <td className="p-3">{list(lead.retailers)}</td>
                    <td className="p-3">{list(lead.states)}</td>
                    <td className="p-3 text-right">{String(lead.unique_shoppers)}</td>
                    <td className="p-3 text-right">{String(lead.receipt_volume)}</td>
                    <td className="p-3 text-right">{String(lead.repeat_purchasers)}</td>
                  </tr>
                ))}
                {data && leads.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-[#9A9AB0]">No unpartnered brands found for these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {selected && (
            <aside className="bg-white border border-[#ECECF5] rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-bold text-[#1A1A2E]">{String(selected.brand)}</h2>
                <button onClick={() => setSelected(null)} className="text-[#9A9AB0] text-xl cursor-pointer" aria-label="Close">×</button>
              </div>
              <dl className="grid grid-cols-3 gap-3 text-center">
                {[["Shoppers", selected.unique_shoppers], ["Receipts", selected.receipt_volume], ["Repeat", selected.repeat_purchasers]].map(([label, value]) => (
                  <div key={String(label)} className="bg-[#F6F6FB] rounded-xl p-3">
                    <dt className="text-[10px] uppercase text-[#9A9AB0] font-semibold">{String(label)}</dt>
                    <dd className="text-lg font-bold text-[#1A1A2E]">{String(value)}</dd>
                  </div>
                ))}
              </dl>
              <div className="text-sm text-[#454656] flex flex-col gap-1">
                <span><b>Products:</b> {list(selected.product_texts)}</span>
                <span><b>Categories:</b> {list(selected.categories)}</span>
                <span><b>Retailers:</b> {list(selected.retailers)}</span>
                <span><b>States:</b> {list(selected.states)}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A9AB0]">Outreach message</span>
                <p className="text-sm text-[#1A1A2E] bg-[#F6F6FB] rounded-lg p-3">{String(selected.outreach_message)}</p>
                <button onClick={() => void navigator.clipboard.writeText(String(selected.outreach_message))}
                  className="self-start text-xs font-semibold text-[#3E3EDF] cursor-pointer">Copy message</button>
              </div>
              <div className="flex flex-col gap-2 border-t border-[#ECECF5] pt-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A9AB0]">Brand name</span>
                <p className="text-xs text-[#6B6B80]">
                  Detected from receipt text ({list(selected.tokens)}). Rename it, or give two detected names the same name to merge them.
                </p>
                <div className="flex gap-2">
                  <input className={`${inputClass} flex-1`} value={rename} onChange={(e) => setRename(e.target.value)} />
                  <button onClick={() => void saveRule(false)} disabled={!rename.trim()}
                    className="h-10 px-4 rounded-full bg-[#3E3EDF] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">Save</button>
                </div>
                <button onClick={() => void saveRule(true)} className="self-start text-xs font-semibold text-red-600 cursor-pointer">
                  Not a brand — hide it (e.g. store brand or generic item)
                </button>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
};
