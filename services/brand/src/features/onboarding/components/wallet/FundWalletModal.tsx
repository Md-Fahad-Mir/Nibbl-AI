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

    // The payment succeeded; the wallet is credited by the Stripe webhook a
    // moment later, so refresh shortly after.
    setDone(true);
    setTimeout(() => {
      refreshWallet().catch(() => {});
    }, 2500);
  };

  if (done) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
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
          className="mt-2 h-11 rounded-xl bg-[#001BD2] text-sm font-extrabold text-white transition hover:bg-[#001BD2]/90"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement />
      {error && <p className="text-xs font-bold text-red-500">{error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="h-11 flex-1 rounded-xl border border-[#C5C5D9]/40 text-sm font-bold text-[#454656] transition hover:bg-[#F2F3FF]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || submitting}
          className="h-11 flex-1 rounded-xl bg-[#001BD2] text-sm font-extrabold text-white transition hover:bg-[#001BD2]/90 disabled:cursor-not-allowed disabled:opacity-60"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#131B2E]">Add Funds</h2>
            <p className="text-sm text-[#454656]">
              Fund your brand wallet with a card.
            </p>
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

        {!stripeConfigured ? (
          <p className="text-sm font-semibold text-red-500">
            Payments are not configured (missing Stripe publishable key).
          </p>
        ) : error ? (
          <p className="text-sm font-semibold text-red-500">{error}</p>
        ) : !clientSecret ? (
          <p className="text-sm text-[#454656]">Preparing secure payment…</p>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm amount={amount} onClose={onClose} />
          </Elements>
        )}
      </div>
    </div>
  );
}
