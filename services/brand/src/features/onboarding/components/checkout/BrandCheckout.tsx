"use client";

import { useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatMoney } from "../../utils/backendMappers";

const stripePromise = getStripe();

/** Wait for the payment webhook to activate the brand, then open the dashboard. */
const useActivationPoll = () => {
  const loadWorkspace = useBrandApiStore((s) => s.loadWorkspace);
  return async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await loadWorkspace();
      if (useBrandApiStore.getState().selectedBrandId) return true;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return false;
  };
};

function PayForm({ due, onPaid }: { due: string; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const pay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError("");
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    if (confirmError) {
      setError(confirmError.message ?? "Payment could not be completed.");
      setSubmitting(false);
      return;
    }
    onPaid();
  };

  return (
    <form onSubmit={pay} className="flex flex-col gap-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      <button type="submit" disabled={!stripe || submitting}
        className="h-12 rounded-full bg-[#001BD2] text-white font-bold text-sm disabled:opacity-50 cursor-pointer">
        {submitting ? "Processing…" : `Pay ${formatMoney(due)} and activate`}
      </button>
    </form>
  );
}

/** Master "Checkout & Activation": confirm the plan, apply a promo code, pay
 *  the first 30-day plan charge and activate the brand account. */
export default function BrandCheckout({ application }: { application: ApiRecord }) {
  const applicationId = String(application.id);
  const waitForActivation = useActivationPoll();
  const [plans, setPlans] = useState<ApiRecord[]>([]);
  const [plan, setPlan] = useState(String(application.requested_plan ?? "pro"));
  const [promo, setPromo] = useState("");
  const [quote, setQuote] = useState<ApiRecord | null>(null);
  const [clientSecret, setClientSecret] = useState("");
  const [activating, setActivating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    apiClient
      .request<ApiRecord[] | { results: ApiRecord[] }>(backendApi.billing.plans)
      .then((list) => live && setPlans(Array.isArray(list) ? list : list.results))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    apiClient
      .request<ApiRecord>(backendApi.brand.checkoutQuote(applicationId), { body: { plan } })
      .then((result) => live && setQuote(result))
      .catch((err) => live && setError(err instanceof Error ? err.message : "Could not load checkout."));
    return () => {
      live = false;
    };
  }, [applicationId, plan]);

  const applyPromo = async () => {
    setBusy(true);
    setError("");
    try {
      setQuote(await apiClient.request<ApiRecord>(backendApi.brand.checkoutQuote(applicationId), {
        body: { plan, promo_code: promo },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid promo code.");
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    setActivating(true);
    if (!(await waitForActivation())) {
      setActivating(false);
      setError("Payment received — your account is still activating. Refresh in a minute.");
    }
  };

  const startCheckout = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await apiClient.request<ApiRecord>(backendApi.brand.checkout(applicationId), {
        body: { plan, promo_code: String(quote?.promo_code ?? "") },
      });
      if (result.activated) await activate();
      else setClientSecret(String(result.client_secret));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  };

  if (application.status === "rejected") {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm max-w-2xl font-manrope">
        <h1 className="text-2xl font-extrabold text-[#131B2E]">We couldn&apos;t set up this account.</h1>
        <p className="text-sm text-[#454656] mt-3">
          {String(application.decision_reason || "Contact Nibbl Support for help.")}
        </p>
      </div>
    );
  }

  if (activating) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm max-w-2xl font-manrope">
        <h1 className="text-2xl font-extrabold text-[#131B2E]">Activating your account…</h1>
        <p className="text-sm text-[#454656] mt-3">This takes a few seconds. Your dashboard opens automatically.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[720px] flex flex-col gap-6 font-manrope text-left">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-wider text-[#001BD2]">Checkout & activation</p>
        <h1 className="text-2xl font-extrabold text-[#131B2E] mt-2">Activate {String(application.brand_name)}</h1>
        <p className="text-sm text-[#454656] mt-1">
          Pay for your first 30 days and your dashboard opens right away. Next, you&apos;ll set up your first campaign
          and fund your wallet before launch.
        </p>
      </div>

      {!clientSecret && (
        <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 shadow-sm flex flex-col gap-4">
          <h2 className="font-jakarta font-bold text-[#131B2E]">Your plan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {plans.map((option) => {
              const slug = String(option.slug);
              return (
                <button key={slug} type="button" onClick={() => setPlan(slug)}
                  className={`text-left rounded-2xl border p-3 cursor-pointer ${
                    plan === slug ? "border-[#001BD2] bg-[#F2F3FF]" : "border-slate-200 bg-white"
                  }`}>
                  <div className="text-sm font-extrabold text-[#131B2E]">{String(option.name)}</div>
                  <div className="text-xs text-[#454656]">{formatMoney(option.monthly_price)} every 30 days</div>
                  <div className="text-[11px] text-[#757688] mt-1">
                    {String(option.max_active_campaigns)} active rebate campaign(s) · {Number(option.rebate_fee_percent)}% fee
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Promo code"
              className="flex-1 h-11 px-3 rounded-xl border border-[#E0E3F5] text-sm outline-none focus:border-[#001BD2] uppercase" />
            <button type="button" onClick={() => void applyPromo()} disabled={busy || !promo.trim()}
              className="h-11 px-5 rounded-full bg-[#E2E7FF] text-[#001BD2] font-bold text-sm disabled:opacity-50 cursor-pointer">
              Apply
            </button>
          </div>
          {quote && (
            <dl className="text-sm flex flex-col gap-1 border-t border-[#F1F2FA] pt-3">
              <div className="flex justify-between"><dt>{String(quote.plan_name)} — first 30 days</dt><dd>{formatMoney(quote.price)}</dd></div>
              {Number(quote.promo_credit) > 0 && (
                <div className="flex justify-between text-[#15803D]">
                  <dt>Promo {String(quote.promo_code)}</dt><dd>−{formatMoney(quote.promo_credit)}</dd>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-[#131B2E] text-base">
                <dt>Due today</dt><dd>{formatMoney(quote.due_today)}</dd>
              </div>
              {Number(quote.promo_credit) > Number(quote.price) && (
                <p className="text-xs text-[#64748B]">Remaining promo credit stays in your wallet for Nibbl fees.</p>
              )}
            </dl>
          )}
          {error && <p className="text-xs font-bold text-red-600">{error}</p>}
          <button type="button" onClick={() => void startCheckout()} disabled={busy || !quote}
            className="h-12 rounded-full bg-[#001BD2] text-white font-bold text-sm disabled:opacity-50 cursor-pointer">
            {Number(quote?.due_today ?? 1) > 0 ? "Continue to payment" : "Activate account"}
          </button>
        </section>
      )}

      {clientSecret && (
        <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 shadow-sm flex flex-col gap-4">
          <h2 className="font-jakarta font-bold text-[#131B2E]">Payment details</h2>
          {!stripeConfigured ? (
            <p className="text-sm font-semibold text-red-600">Payments are not configured (missing Stripe publishable key).</p>
          ) : (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PayForm due={String(quote?.due_today ?? "0")} onPaid={() => void activate()} />
            </Elements>
          )}
          {error && <p className="text-xs font-bold text-red-600">{error}</p>}
          <button type="button" onClick={() => setClientSecret("")}
            className="self-start text-xs font-bold text-[#454656] cursor-pointer">← Change plan or promo code</button>
        </section>
      )}
    </div>
  );
}
