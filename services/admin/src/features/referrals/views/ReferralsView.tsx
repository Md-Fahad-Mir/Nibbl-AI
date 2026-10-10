"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/features/dashboard/components/Sidebar";
import { Header } from "@/features/dashboard/components/Header";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useAdminApiStore } from "@/stores/useAdminApiStore";
import { ApiRecord, nibblApi } from "@/lib/api/backendApi";

const TABS = [
  { value: "flagged", label: "Flagged" },
  { value: "in_progress", label: "In progress" },
  { value: "qualified", label: "Qualified" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
];

const BADGE: Record<string, string> = {
  in_progress: "bg-[#F6F6FB] text-[#454656]",
  flagged: "bg-red-50 text-red-700",
  paid: "bg-emerald-50 text-emerald-700",
  rejected: "bg-slate-100 text-slate-500",
};

const person = (p: unknown) => {
  const x = (p ?? {}) as ApiRecord;
  return `${String(x.full_name || "—")} · ${String(x.email || "")}${x.is_active === false ? " (suspended)" : ""}`;
};

const ReferralCard = ({ referral, onChanged }: { referral: ApiRecord; onChanged: (msg: string) => void }) => {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = String(referral.status);
  const steps = (Array.isArray(referral.steps) ? referral.steps : []) as ApiRecord[];

  const act = async (action: "approve" | "reject" | "suspend", body: ApiRecord = {}) => {
    setBusy(true);
    setError("");
    try {
      await nibblApi.adminReferralAction(String(referral.id), action, body);
      onChanged(action === "approve" ? "Referral approved and paid." : action === "reject" ? "Referral rejected." : "Shopper suspended and referral rejected.");
    } catch (err) {
      setError((err as Error).message || "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-[#ECECF5] rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="text-sm flex flex-col gap-1">
          <span><b className="text-[#1A1A2E]">Referrer:</b> {person(referral.referrer)}</span>
          <span><b className="text-[#1A1A2E]">New shopper:</b> {person(referral.referred)}</span>
          {Boolean(referral.campaign) && <span className="text-xs text-[#6B6B80]">Joined through the deal: {String(referral.campaign)}</span>}
        </div>
        <div className="text-right text-xs text-[#6B6B80] flex flex-col items-end gap-1">
          <span className={`px-2 py-0.5 rounded-full font-semibold ${BADGE[status] ?? ""}`}>{status.replace("_", " ")}</span>
          {referral.reward_amount ? <span>Reward ${String(referral.reward_amount)}</span> : null}
        </div>
      </div>

      <ol className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {steps.map((s) => (
          <li key={String(s.key)} className={`rounded-lg px-3 py-2 text-xs ${s.done ? "bg-emerald-50 text-emerald-800" : "bg-[#F6F6FB] text-[#9A9AB0]"}`}>
            {s.done ? "✓ " : ""}{String(s.label)}
          </li>
        ))}
      </ol>

      {Boolean(referral.flag_reason) && (
        <div className="border border-red-100 bg-red-50/60 rounded-xl p-3 text-sm text-red-700">
          <b>Flag reason:</b> {String(referral.flag_reason)}
        </div>
      )}
      {status === "rejected" && Boolean(referral.decision_reason) && (
        <p className="text-sm text-[#454656]"><b>Shown to shopper:</b> {String(referral.decision_reason)}</p>
      )}

      {(status === "flagged" || status === "rejected") && (
        <div className="flex flex-col gap-2">
          {status === "flagged" && (
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Reason shown to the shopper (required to reject or suspend)"
              className="h-10 px-3 rounded-lg border border-[#E0E0F0] text-sm outline-none focus:border-[#3E3EDF]" />
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => void act("approve")}
              className="h-9 px-4 rounded-full bg-[#3E3EDF] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">
              Approve &amp; pay
            </button>
            {status === "flagged" && (
              <>
                <button disabled={busy || !reason.trim()} onClick={() => void act("reject", { reason })}
                  className="h-9 px-4 rounded-full border border-red-200 text-red-600 text-sm font-semibold disabled:opacity-50 cursor-pointer">
                  Reject
                </button>
                <button disabled={busy || !reason.trim()} onClick={() => void act("suspend", { target: "referred", reason })}
                  className="h-9 px-4 rounded-full border border-red-200 text-red-600 text-sm font-semibold disabled:opacity-50 cursor-pointer">
                  Suspend new shopper
                </button>
                <button disabled={busy || !reason.trim()} onClick={() => void act("suspend", { target: "referrer", reason })}
                  className="h-9 px-4 rounded-full border border-red-200 text-red-600 text-sm font-semibold disabled:opacity-50 cursor-pointer">
                  Suspend referrer
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/** Master Admin Sheet 3 "Referrals": qualification tracking with flagged
 *  referrals kept separate for review. */
export const ReferralsView = () => {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { profile, loadProfile, logout } = useAdminApiStore();
  const [tab, setTab] = useState("flagged");
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
      .adminReferrals(tab)
      .then((result) => live && (setData(result), setError("")))
      .catch((err: Error) => live && setError(err.message || "Could not load referrals."));
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
      <Sidebar activeNav="referrals" onNavSelect={handleNavSelect} isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)} />
      <main className="flex-1 w-full min-h-screen p-4 sm:p-6 md:p-8 flex flex-col gap-6 items-stretch bg-[#FEFEFE] overflow-x-hidden font-inter">
        <Header adminName={String(profile?.full_name || profile?.email || "Admin")} adminRole={String(profile?.role || "Admin")}
          unreadCount={0} onToggleMobileMenu={() => setIsMobileMenuOpen(true)} onProfileClick={() => router.push("/settings")} />
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Referrals</h1>
          <p className="text-sm text-[#6B6B80] mt-1">
            A referral pays $5 only after the new shopper joins with the link, claims an offer, gets a redemption
            approved, connects a payout method and completes a withdrawal. Referrals matching a flag rule wait here.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[["In progress", summary.in_progress], ["Qualified", summary.qualified], ["Flagged", summary.flagged], ["Paid", summary.paid]].map(([label, value]) => (
            <div key={String(label)} className="bg-white border border-[#ECECF5] rounded-2xl p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#9A9AB0]">{String(label)}</div>
              <div className="text-2xl font-bold text-[#1A1A2E] mt-1">{String(value ?? "—")}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t.value} onClick={() => { setTab(t.value); setNotice(""); }}
              className={`h-10 px-5 rounded-full text-sm font-semibold cursor-pointer ${
                tab === t.value ? "bg-[#3E3EDF] text-white" : "bg-[#F6F6FB] text-[#454656]"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {notice && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-lg px-3 py-2">{notice}</div>}
        {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

        {data && results.length === 0 ? (
          <div className="bg-white border border-[#ECECF5] rounded-2xl p-10 text-center text-[#9A9AB0]">Nothing here.</div>
        ) : (
          results.map((referral) => (
            <ReferralCard key={String(referral.id)} referral={referral}
              onChanged={(msg) => { setNotice(msg); setReloadKey((k) => k + 1); }} />
          ))
        )}
      </main>
    </div>
  );
};
