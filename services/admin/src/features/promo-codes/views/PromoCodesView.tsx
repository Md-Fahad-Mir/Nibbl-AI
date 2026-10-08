"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/features/dashboard/components/Sidebar";
import { Header } from "@/features/dashboard/components/Header";
import { SidebarNavItem } from "@/types/dashboard.types";
import { useAdminApiStore } from "@/stores/useAdminApiStore";
import { ApiRecord } from "@/lib/api/backendApi";

const money = (value: unknown) => `$${Number(value ?? 0).toFixed(2)}`;
const dateText = (value: unknown) =>
  typeof value === "string" && value ? new Date(value).toLocaleDateString() : "—";

const emptyForm = {
  code: "",
  amount: "",
  note: "",
  valid_from: "",
  valid_until: "",
  max_redemptions: "",
  once_per_brand: true,
};

export const PromoCodesView = () => {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { profile, loadProfile, logout, promoCodes, loadPromoCodes, createPromoCode } =
    useAdminApiStore();

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void loadProfile();
    void loadPromoCodes();
  }, [loadProfile, loadPromoCodes]);

  const handleNavSelect = (item: SidebarNavItem) => {
    switch (item) {
      case "dashboard":
        router.push("/dashboard");
        break;
      case "earnings":
        router.push("/earnings");
        break;
      case "users":
        router.push("/users");
        break;
      case "brand":
        router.push("/brand");
        break;
      case "promo-codes":
        router.push("/promo-codes");
        break;
      case "payout-reviews":
        router.push("/payout-reviews");
        break;
      case "withdraw-request":
        router.push("/withdraw-request");
        break;
      case "settings":
        router.push("/settings");
        break;
      case "logout":
        logout();
        router.push("/");
        break;
      default:
        break;
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!form.code.trim() || !form.amount) {
      setError("A code and amount are required.");
      return;
    }
    const body: ApiRecord = {
      code: form.code.trim(),
      amount: form.amount,
      once_per_brand: form.once_per_brand,
    };
    if (form.note.trim()) body.note = form.note.trim();
    if (form.valid_from) body.valid_from = new Date(form.valid_from).toISOString();
    if (form.valid_until) body.valid_until = new Date(form.valid_until).toISOString();
    if (form.max_redemptions) body.max_redemptions = Number(form.max_redemptions);

    setSubmitting(true);
    try {
      const created = await createPromoCode(body);
      setSuccess(`Promo code ${String(created.code ?? "")} created.`);
      setForm(emptyForm);
    } catch (err) {
      setError((err as Error).message || "Could not create the promo code.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full h-11 px-3 rounded-lg border border-[#E0E0F0] text-[15px] text-[#1A1A2E] outline-none focus:border-[#3E3EDF] focus:ring-2 focus:ring-[#3E3EDF]/15";

  return (
    <div className="flex min-h-screen w-full bg-[#FEFEFE]">
      <Sidebar
        activeNav="promo-codes"
        onNavSelect={handleNavSelect}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <main className="flex-1 w-full min-h-screen p-4 sm:p-6 md:p-8 flex flex-col gap-6 items-stretch bg-[#FEFEFE] overflow-x-hidden font-inter">
        <Header
          adminName={String(profile?.full_name || profile?.email || "Admin")}
          adminRole={String(profile?.role || "Admin")}
          unreadCount={0}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          onProfileClick={() => router.push("/settings")}
        />

        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Promo Codes</h1>
          <p className="text-sm text-[#6B6B80] mt-1">
            Create reusable promotional codes. Promo credit covers platform fees and
            subscriptions — it never funds shopper rewards.
          </p>
        </div>

        {/* Create form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-[#ECECF5] rounded-2xl p-6 shadow-sm flex flex-col gap-4"
        >
          <h2 className="text-base font-bold text-[#1A1A2E]">Create a code</h2>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-lg px-3 py-2">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="flex flex-col gap-1 text-sm font-semibold text-[#454656]">
              Code
              <input
                className={inputClass}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="WELCOME50"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-[#454656]">
              Amount ($)
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="50.00"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-[#454656]">
              Note (optional)
              <input
                className={inputClass}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Launch promo"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-[#454656]">
              Valid from (optional)
              <input
                className={inputClass}
                type="datetime-local"
                value={form.valid_from}
                onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-[#454656]">
              Valid until (optional)
              <input
                className={inputClass}
                type="datetime-local"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-[#454656]">
              Max redemptions (optional)
              <input
                className={inputClass}
                type="number"
                min="1"
                step="1"
                value={form.max_redemptions}
                onChange={(e) => setForm({ ...form, max_redemptions: e.target.value })}
                placeholder="Unlimited"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-[#454656]">
            <input
              type="checkbox"
              checked={form.once_per_brand}
              onChange={(e) => setForm({ ...form, once_per_brand: e.target.checked })}
            />
            One redemption per brand
          </label>

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="h-11 px-6 bg-[#3E3EDF] hover:bg-[#3333c4] text-white font-semibold text-sm rounded-full transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Creating…" : "Create promo code"}
            </button>
          </div>
        </form>

        {/* List */}
        <div className="bg-white border border-[#ECECF5] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#ECECF5]">
            <h2 className="text-base font-bold text-[#1A1A2E]">Existing codes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F6F6FB] text-[#6B6B80] text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-semibold">Code</th>
                  <th className="px-6 py-3 font-semibold">Amount</th>
                  <th className="px-6 py-3 font-semibold">Used</th>
                  <th className="px-6 py-3 font-semibold">Valid until</th>
                  <th className="px-6 py-3 font-semibold">Per brand</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {promoCodes.map((code) => (
                  <tr key={String(code.id)} className="border-t border-[#F0F0F7]">
                    <td className="px-6 py-3 font-bold text-[#1A1A2E]">{String(code.code)}</td>
                    <td className="px-6 py-3 text-[#454656]">{money(code.amount)}</td>
                    <td className="px-6 py-3 text-[#454656]">
                      {String(code.redemption_count ?? 0)}
                      {code.max_redemptions ? ` / ${code.max_redemptions}` : ""}
                    </td>
                    <td className="px-6 py-3 text-[#454656]">{dateText(code.valid_until)}</td>
                    <td className="px-6 py-3 text-[#454656]">
                      {code.once_per_brand ? "Once" : "Multiple"}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          code.is_active
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {code.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
                {promoCodes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-[#9A9AB0]">
                      No promo codes yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
