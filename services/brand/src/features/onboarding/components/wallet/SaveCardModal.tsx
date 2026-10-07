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

interface SaveCardModalProps {
  onClose: () => void;
  onSaved: (paymentMethodId: string) => void;
}

function SetupForm({ onClose, onSaved }: SaveCardModalProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError("");

    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Card could not be saved.");
      setSubmitting(false);
      return;
    }

    const pmId =
      typeof setupIntent?.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id;
    if (pmId) {
      onSaved(pmId);
    } else {
      setError("Card saved but no payment method was returned.");
      setSubmitting(false);
    }
  };

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
          {submitting ? "Saving…" : "Save card"}
        </button>
      </div>
    </form>
  );
}

export default function SaveCardModal({ onClose, onSaved }: SaveCardModalProps) {
  const createSetupIntent = useBrandApiStore((state) => state.createSetupIntent);
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    createSetupIntent()
      .then((res) => {
        if (!cancelled) setClientSecret(res.client_secret);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Could not start card setup.");
      });
    return () => {
      cancelled = true;
    };
  }, [createSetupIntent]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#C5C5D9]/20 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#131B2E]">Save a card</h2>
            <p className="text-sm text-[#454656]">Used for automatic wallet refills.</p>
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
          <p className="px-6 py-8 text-sm font-semibold text-red-500">
            Payments are not configured (missing Stripe publishable key).
          </p>
        ) : error ? (
          <p className="px-6 py-8 text-sm font-semibold text-red-500">{error}</p>
        ) : !clientSecret ? (
          <p className="px-6 py-8 text-sm text-[#454656]">Preparing secure form…</p>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <SetupForm onClose={onClose} onSaved={onSaved} />
          </Elements>
        )}
      </div>
    </div>
  );
}
