"use client";

import { useState } from "react";
import CustomerMetrics from "./CustomerMetrics";
import CustomerLedger, { CustomerData } from "./CustomerLedger";
import CustomerProfileView from "./CustomerProfileView";
import SuspendCustomerModal from "./SuspendCustomerModal";
import { ApiRecord, API_BASE_URL, backendAssetUrl, tokenStorage } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatDate, formatMoney, toNumber } from "../../utils/backendMappers";

const readString = (...values: unknown[]) => {
  const value = values.find((item) => typeof item === "string" && item.trim());
  return typeof value === "string" ? value.trim() : "";
};

const mapCustomer = (customer: ApiRecord): CustomerData => {
  const customerRef = readString(customer.customer_ref, customer.id);
  const userId = readString(customer.user_id);
  const email = readString(customer.email);
  const name =
    readString(customer.full_name, customer.name, customer.display_name, customer.username) ||
    (email ? email.split("@")[0] : "Hidden customer");
  const isActive =
    customer.is_active === false ||
    customer.is_suspended === true ||
    String(customer.status ?? customer.suspension_status ?? "").toLowerCase() === "suspended"
      ? false
      : true;
  const recentReceipts = Array.isArray(customer.recent_receipts)
    ? customer.recent_receipts.map((receipt) => {
        const item = receipt as ApiRecord;
        return {
          merchant: readString(item.merchant, item.store, item.campaign_name) || "Receipt submission",
          date: formatDate(item.created_at ?? item.purchased_at) || "Recent",
          id: readString(item.id, item.receipt_id) || "Receipt",
          value: formatMoney(item.total ?? item.amount ?? 0),
          points: readString(item.points, item.reward_label) || `${formatMoney(item.reward_amount ?? 0)} reward`,
          status: readString(item.status) || "Submitted",
        };
      })
    : undefined;

  return {
    id: userId || customerRef,
    userId,
    name,
    memberId: customerRef || (userId ? userId.slice(0, 12) : "pending"),
    email: email || "Hidden by plan",
    phone: readString(customer.phone, customer.phone_number) || "Unavailable",
    claims: toNumber(customer.redemptions),
    reviews: toNumber(customer.reviews),
    rewards: formatMoney(customer.total_earned),
    status: isActive ? "Active" : "Suspended",
    lastActivity: formatDate(customer.last_activity_at ?? customer.updated_at ?? customer.created_at) || "Backend record",
    avatar: backendAssetUrl(
      customer.avatar_url ?? customer.user_avatar_url ?? customer.avatar,
      ""
    ),
    memberSince: formatDate(customer.created_at ?? customer.member_since) || "Unavailable",
    canSuspend: Boolean(userId),
    fraudScore: readString(customer.fraud_score, customer.risk_score) || "Unavailable",
    trustLabel: readString(customer.trust_label, customer.risk_label) || "Not scored",
    recentReceipts,
  };
};

export default function CustomersView() {
  const [selectedCust, setSelectedCust] = useState<CustomerData | null>(null);
  const [modalCust, setModalCust] = useState<CustomerData | null>(null);
  const [filterTab, setFilterTab] = useState<"All" | "Active" | "Suspended">("All");
  const apiCustomers = useBrandApiStore((state) => state.customers);
  const suspendCustomer = useBrandApiStore((state) => state.suspendCustomer);
  const reactivateCustomer = useBrandApiStore((state) => state.reactivateCustomer);
  const selectedBrandId = useBrandApiStore((state) => state.selectedBrandId);
  const [localStatuses, setLocalStatuses] = useState<Record<string, CustomerData["status"]>>({});
  const [actionError, setActionError] = useState("");
  const [isActioning, setIsActioning] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!selectedBrandId || exporting) return;
    setExporting(true);
    setActionError("");
    try {
      const token = tokenStorage.getAccess();
      const response = await fetch(
        `${API_BASE_URL}/brands/${selectedBrandId}/customers/export/`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!response.ok) throw new Error("Could not export customers.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "customers.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not export customers.");
    } finally {
      setExporting(false);
    }
  };
  const customers = apiCustomers.map((customer) => {
    const mapped = mapCustomer(customer);
    return { ...mapped, status: localStatuses[mapped.id] || mapped.status };
  });

  const handleConfirmToggle = async () => {
    if (!modalCust) return;
    if (!modalCust.userId) {
      setActionError("Backend must return user_id for this customer before account actions can run.");
      return;
    }
    setIsActioning(true);
    setActionError("");
    try {
      const nextStatus: CustomerData["status"] =
        modalCust.status === "Active" ? "Suspended" : "Active";
      if (modalCust.status === "Active") {
        await suspendCustomer(modalCust.userId, "Suspended from brand dashboard.");
      } else {
        await reactivateCustomer(modalCust.userId);
      }
      setLocalStatuses((prev) => ({
        ...prev,
        [modalCust.id]: nextStatus,
      }));
      if (selectedCust && selectedCust.id === modalCust.id) {
        setSelectedCust((prev) => prev ? { ...prev, status: nextStatus } : null);
      }
      setModalCust(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not update customer status.");
    } finally {
      setIsActioning(false);
    }
  };

  const filtered = customers.filter(c => filterTab === "All" || c.status === filterTab);
  const totalClaims = customers.reduce((sum, customer) => sum + customer.claims, 0);
  const totalRewards = apiCustomers.reduce(
    (sum, customer) => sum + toNumber(customer.total_earned),
    0
  );

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left font-manrope">
      
      {/* Upper header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end w-full gap-4 pb-2">
        <div className="flex flex-col gap-1 text-left">
          <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight leading-none">Customer Management</h2>
          <p className="text-xs text-[#454656] font-medium mt-1">Manage institutional ledgers and member status.</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || customers.length === 0}
          className="h-11 px-6 bg-white hover:bg-slate-50 text-[#001BD2] border border-[#001BD2]/20 font-bold text-sm rounded-full transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {selectedCust ? (
        <CustomerProfileView
          customer={selectedCust}
          onBack={() => setSelectedCust(null)}
          onToggleSuspend={setModalCust}
        />
      ) : (
        <div className="flex flex-col gap-8 w-full">
          {/* Filters Row */}
          <div className="bg-[#F2F3FF] p-1.5 rounded-full flex items-center gap-1.5 w-fit border border-[#C5C5D9]/5">
            {(["All", "Active", "Suspended"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`px-6 py-2 text-xs font-bold rounded-full transition-all border-none cursor-pointer ${
                  filterTab === tab ? "bg-white text-[#001BD2] shadow-sm" : "text-[#454656] hover:text-slate-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <CustomerMetrics
            totalMembers={customers.length}
            activePercent={customers.length ? `${Math.round((customers.filter((c) => c.status === "Active").length / customers.length) * 100)}%` : "0%"}
            totalRewards={formatMoney(totalRewards)}
            averageClaims={customers.length ? (totalClaims / customers.length).toFixed(1) : "0"}
          />
          
          <CustomerLedger
            customers={filtered}
            onSelectCustomer={setSelectedCust}
            onToggleSuspend={(customer) => {
              setActionError("");
              setModalCust(customer);
            }}
          />
        </div>
      )}

      <SuspendCustomerModal
        isOpen={modalCust !== null}
        customerName={modalCust?.name || ""}
        isSuspended={modalCust?.status === "Suspended"}
        onConfirm={handleConfirmToggle}
        onClose={() => {
          if (isActioning) return;
          setActionError("");
          setModalCust(null);
        }}
        isLoading={isActioning}
        error={actionError}
      />

    </div>
  );
}
