"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/features/dashboard/components/Sidebar";
import { Header } from "@/features/dashboard/components/Header";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useAdminApiStore } from "@/stores/useAdminApiStore";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "refunded", label: "Refunded" },
  { value: "rejected", label: "Rejected" },
];

const money = (value: unknown) => `$${Number(value ?? 0).toFixed(2)}`;
const date = (value: unknown) => (value ? new Date(String(value)).toLocaleDateString() : "—");

const RefundCard = ({ refund, onChanged }: { refund: ApiRecord; onChanged: (msg: string) => void }) => {
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = String(refund.status);
  const short = Number(refund.amount) > Number(refund.available_cash);

  const act = async (action: "refunded" | "reject") => {
    setBusy(true);
    setError("");
    try {
      await nibblApi.adminRefundRequestAction(String(refund.id), action, { reference, note });
      onChanged(action === "refunded" ? "Marked refunded — the wallet was debited." : "Refund request rejected.");
    } catch (err) {
      setError((err as Error).message || "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-[#ECECF5] rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="text-sm flex flex-col gap-1">
          <span className="text-lg font-bold text-[#1A1A2E]">{money(refund.amount)} · {String(refund.brand_name)}</span>
          <span className="text-xs text-[#6B6B80]">
            Requested {date(refund.created_at)} by {String(refund.requested_by || "—")}
          </span>
          {Boolean(refund.reason) && <span className="text-[#454656]"><b>Reason:</b> {String(refund.reason)}</span>}
        </div>
        <div className="text-right text-xs text-[#6B6B80] flex flex-col items-end gap-1">
          {status === "pending" && (
            <span className={short ? "text-red-600 font-semibold" : ""}>Available Cash now: {money(refund.available_cash)}</span>
          )}
          {status !== "pending" && <span>Decided {date(refund.decided_at)}</span>}
          {Boolean(refund.stripe_reference) && <span>Stripe ref: {String(refund.stripe_reference)}</span>}
        </div>
      </div>
      {status !== "pending" && Boolean(refund.decision_note) && (
        <p className="text-sm text-[#454656]"><b>Note to brand:</b> {String(refund.decision_note)}</p>
      )}
      {status === "pending" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#6B6B80]">
            Return the money to the brand in Stripe first, then mark it refunded here — that debits their wallet.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Stripe refund ID (e.g. re_…)"
              className="h-10 px-3 rounded-lg border border-[#E0E0F0] text-sm outline-none focus:border-[#3E3EDF]" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the brand (required to reject)"
              className="h-10 px-3 rounded-lg border border-[#E0E0F0] text-sm outline-none focus:border-[#3E3EDF]" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button disabled={busy || short} onClick={() => void act("refunded")}
              className="h-9 px-4 rounded-full bg-[#3E3EDF] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">
              Mark refunded
            </button>
            <button disabled={busy || !note.trim()} onClick={() => void act("reject")}
              className="h-9 px-4 rounded-full border border-red-200 text-red-600 text-sm font-semibold disabled:opacity-50 cursor-pointer">
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/** Brand refund requests (Master Wallet: Available Cash is refundable). */
export const RefundsView = () => {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { profile, loadProfile, logout } = useAdminApiStore();
  const [tab, setTab] = useState("pending");
  const [data, setData] = useState<ApiRecord | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    let live = true;
    nibblApi
      .adminRefundRequests(tab)
      .then((result) => live && (setData(result), setError("")))
      .catch((err: Error) => live && setError(err.message || "Could not load refund requests."));
    return () => {
      live = false;
    };
  }, [tab, reloadKey]);

  const handleNavSelect = (item: SidebarNavItem) => {
    if (item === "logout") {
      logout();
      router.push("/");
      return;
    }
    router.push(`/${item}`);
  };

  const summary = (data?.summary ?? {}) as ApiRecord;
  const results = (Array.isArray(data?.results) ? data.results : []) as ApiRecord[];

  return (
    <div className="flex min-h-screen w-full bg-[#FEFEFE]">
      <Sidebar activeNav="refunds" onNavSelect={handleNavSelect} isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)} />
      <main className="flex-1 w-full min-h-screen p-4 sm:p-6 md:p-8 flex flex-col gap-6 items-stretch bg-[#FEFEFE] overflow-x-hidden font-inter">
        <Header adminName={String(profile?.full_name || profile?.email || "Admin")} adminRole={String(profile?.role || "Admin")}
          unreadCount={0} onToggleMobileMenu={() => setIsMobileMenuOpen(true)} onProfileClick={() => router.push("/settings")} />
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Refund Requests</h1>
          <p className="text-sm text-[#6B6B80] mt-1">
            Brands may request a refund of their Available Cash. Reserved Funds and Promotional Credits are non-refundable.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t.value} onClick={() => { setTab(t.value); setNotice(""); }}
              className={`h-10 px-5 rounded-full text-sm font-semibold cursor-pointer ${
                tab === t.value ? "bg-[#3E3EDF] text-white" : "bg-[#F6F6FB] text-[#454656]"
              }`}>
              {t.label} ({String(summary[t.value] ?? 0)})
            </button>
          ))}
        </div>

        {notice && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-lg px-3 py-2">{notice}</div>}
        {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

        {data && results.length === 0 ? (
          <div className="bg-white border border-[#ECECF5] rounded-2xl p-10 text-center text-[#9A9AB0]">Nothing here.</div>
        ) : (
          results.map((refund) => (
            <RefundCard key={String(refund.id)} refund={refund}
              onChanged={(msg) => { setNotice(msg); setReloadKey((k) => k + 1); }} />
          ))
        )}
      </main>
    </div>
  );
};
