"use client";

import { useEffect, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

const stripePromise = getStripe();

interface FundWalletModalProps {
  amount: string; // dollars, e.g. "250.00"
  onClose: () => void;
}

function PaymentForm({ amount, onClose }: FundWalletModalProps) {
  const stripe = useStripe();
  const elements = useElements();
  const refreshWallet = useBrandApiStore((state) => state.refreshWallet);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
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

    setDone(true);
    setTimeout(() => {
      refreshWallet().catch(() => {});
    }, 2500);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
          ✓
        </div>
        <h3 className="text-lg font-bold text-[#131B2E]">Payment received</h3>
        <p className="text-sm text-[#454656]">
          ${amount} is on its way to your wallet. Your balance updates in a few
          seconds.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 h-11 w-full rounded-xl bg-[#001BD2] text-sm font-extrabold text-white transition hover:bg-[#001BD2]/90"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <PaymentElement options={{ layout: "tabs" }} />
        {error && <p className="mt-3 text-xs font-bold text-red-500">{error}</p>}
      </div>
      <div className="flex shrink-0 gap-3 border-t border-[#C5C5D9]/20 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="h-12 flex-1 rounded-xl border border-[#C5C5D9]/40 text-sm font-bold text-[#454656] transition hover:bg-[#F2F3FF]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || submitting}
          className="h-12 flex-[2] rounded-xl bg-[#001BD2] text-sm font-extrabold text-white transition hover:bg-[#001BD2]/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Processing…" : `Pay $${amount}`}
        </button>
      </div>
    </form>
  );
}

export default function FundWalletModal({ amount, onClose }: FundWalletModalProps) {
  const createTopupIntent = useBrandApiStore((state) => state.createTopupIntent);
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    createTopupIntent(amount)
      .then((res) => {
        if (!cancelled) setClientSecret(res.client_secret);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Could not start payment.");
      });
    return () => {
      cancelled = true;
    };
  }, [amount, createTopupIntent]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-[#C5C5D9]/20 px-6 py-5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#454656]">
              Add Funds
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#131B2E]">
              ${amount}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-[#454656] hover:text-[#131B2E]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        {!stripeConfigured ? (
          <p className="px-6 py-8 text-sm font-semibold text-red-500">
            Payments are not configured (missing Stripe publishable key).
          </p>
        ) : error ? (
          <p className="px-6 py-8 text-sm font-semibold text-red-500">{error}</p>
        ) : !clientSecret ? (
          <p className="px-6 py-8 text-sm text-[#454656]">Preparing secure payment…</p>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm amount={amount} onClose={onClose} />
          </Elements>
        )}
      </div>
    </div>
  );
}
