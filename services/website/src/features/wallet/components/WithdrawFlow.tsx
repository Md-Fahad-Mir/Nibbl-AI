"use client";

import { ReactNode, useState } from "react";
import { ApiError, ApiRecord } from "@/lib/api/backendApi";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";
import { Check, Lock, X } from "lucide-react";

export interface PayoutOption {
  id: string;
  provider: string;
  handle: string;
}

interface WithdrawFlowProps {
  available: number;
  methods: PayoutOption[];
  onClose: () => void;
  onAddMethod: () => void;
  onNeedPhone: (methodId: string) => void;
  onViewActivity: () => void;
  onSubmitted: () => void;
}

type Step = "amount" | "method" | "sms" | "confirm" | "review" | "done";

const PROVIDER: Record<string, string> = { paypal: "PayPal", venmo: "Venmo" };
const providerName = (m?: PayoutOption) => (m ? PROVIDER[m.provider.toLowerCase()] ?? m.provider : "");

const shell = "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4";
const card = "w-full max-w-[440px] bg-white rounded-[16px] p-6 flex flex-col gap-4";
const primary = "h-11 rounded-[10px] bg-[#3E3EDF] text-white text-[15px] font-medium cursor-pointer disabled:opacity-50";
const secondary = "h-11 rounded-[10px] bg-[#EEF0FF] text-[#3E3EDF] text-[15px] font-medium cursor-pointer";

const Locked = ({ method }: { method?: PayoutOption }) => (
  <div className="flex items-center justify-between border border-gray-100 rounded-[10px] px-3 py-2.5">
    <span className="text-[14px] text-[#1F1D1D]"><b>{providerName(method)}</b> · {method?.handle}</span>
    <span className="text-[12px] text-[#8A8A8A] flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Locked</span>
  </div>
);

/** Master "Simple Withdrawal Flow": amount → locked payout method → SMS code
 *  → confirm → request submitted (Requested / Processing / Paid). */
export default function WithdrawFlow({
  available, methods, onClose, onAddMethod, onNeedPhone, onViewActivity, onSubmitted,
}: WithdrawFlowProps) {
  const { sendWithdrawalCode, requestWithdrawal } = useConsumerApiStore();
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState(available.toFixed(2));
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [smsRequired, setSmsRequired] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ApiRecord | null>(null);
  const method = methods.find((m) => m.id === methodId);
  const value = Number(amount);
  const amountOk = value >= 0.01 && value <= available + 1e-9;

  const sendCode = async () => {
    setBusy(true);
    setError("");
    try {
      const sent = await sendWithdrawalCode(methodId, value.toFixed(2));
      setPhone(sent.phone);
      setSmsRequired(true);
      setStep("sms");
    } catch (err) {
      const errCode = err instanceof ApiError ? (err.data as { code?: string } | null)?.code : undefined;
      if (err instanceof ApiError && err.status === 503) {
        setSmsRequired(false); // SMS verification switched off: go straight to confirm.
        setStep("confirm");
      } else if (errCode === "phone_verification_required") {
        onNeedPhone(methodId);
      } else {
        setError(err instanceof Error ? err.message : "Could not send the code.");
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const withdrawal = await requestWithdrawal(methodId, value.toFixed(2), smsRequired ? code : undefined);
      setResult(withdrawal);
      onSubmitted();
      setStep(withdrawal.needs_review ? "review" : "done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal request failed.");
    } finally {
      setBusy(false);
    }
  };

  if (step === "amount") {
    return (
      <div className={shell}>
        <div className={card}>
          <Header title="Withdraw Funds" onClose={onClose} />
          <div>
            <div className="text-[13px] text-[#8A8A8A]">Available to withdraw</div>
            <div className="text-[26px] font-semibold text-[#1F1D1D]">${available.toFixed(2)}</div>
          </div>
          <label className="flex flex-col gap-1 text-[13px] text-[#575757]">
            Amount
            <input type="number" min="0.01" step="0.01" max={available} value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 px-3 rounded-[10px] border border-gray-200 text-[16px] text-[#1F1D1D] outline-none focus:border-[#3E3EDF]" />
          </label>
          {methods.length > 0 ? (
            <div className="flex flex-col gap-1 text-[13px] text-[#575757]">
              Send to
              {methods.length > 1 ? (
                <select value={methodId} onChange={(e) => setMethodId(e.target.value)}
                  className="h-11 px-3 rounded-[10px] border border-gray-200 text-[14px] text-[#1F1D1D] outline-none">
                  {methods.map((m) => <option key={m.id} value={m.id}>{providerName(m)} · {m.handle}</option>)}
                </select>
              ) : (
                <Locked method={method} />
              )}
            </div>
          ) : (
            <button onClick={onAddMethod} className={secondary}>Add a payout method</button>
          )}
          {!amountOk && amount !== "" && (
            <p className="text-[12px] text-[#E65353]">Enter an amount between $0.01 and ${available.toFixed(2)}.</p>
          )}
          <button disabled={!amountOk || !method} onClick={() => setStep("method")} className={primary}>Continue</button>
        </div>
      </div>
    );
  }

  if (step === "method") {
    return (
      <div className={shell}>
        <div className={card}>
          <Header title="Payout Method" onClose={onClose} />
          <Locked method={method} />
          <p className="text-[13px] text-[#575757] text-center">Your payout method cannot be edited after it is saved.</p>
          {error && <p className="text-[13px] text-[#E65353]">{error}</p>}
          <button disabled={busy} onClick={() => void sendCode()} className={primary}>{busy ? "Sending code…" : "Continue"}</button>
          <button onClick={onAddMethod} className={secondary}>Request a change</button>
          <p className="text-[12px] text-[#8A8A8A] text-center">Change requests are reviewed before future withdrawals can be processed.</p>
        </div>
      </div>
    );
  }

  if (step === "sms") {
    return (
      <div className={shell}>
        <div className={card}>
          <Header title="Verify this withdrawal" onClose={onClose} />
          <p className="text-[14px] text-[#575757]">We sent a 6-digit code to {phone}.</p>
          <input inputMode="numeric" maxLength={6} value={code} autoFocus
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="h-12 px-3 rounded-[10px] border border-gray-200 text-[22px] tracking-[0.5em] text-center outline-none focus:border-[#3E3EDF]" />
          <button disabled={busy} onClick={() => void sendCode()} className="text-[13px] text-[#3E3EDF] cursor-pointer">Resend code</button>
          <p className="text-[12px] text-[#575757] bg-[#F6F6FB] rounded-[8px] p-3">Never share this code. Nibbl will never ask for it.</p>
          {error && <p className="text-[13px] text-[#E65353]">{error}</p>}
          <button disabled={code.length !== 6} onClick={() => { setError(""); setStep("confirm"); }} className={primary}>
            Verify &amp; Continue
          </button>
          <button onClick={onClose} className={secondary}>Cancel</button>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    const after = Math.max(0, available - value);
    return (
      <div className={shell}>
        <div className={card}>
          <Header title="Confirm Withdrawal" onClose={onClose} />
          <dl className="flex flex-col border border-gray-100 rounded-[10px] divide-y divide-gray-100 text-[14px]">
            {([
              ["Amount", `$${value.toFixed(2)}`],
              ["Send to", `${providerName(method)} · ${method?.handle ?? ""}`],
              ["Payout method", <span key="locked" className="inline-flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Locked</span>],
              ["Wallet balance after request", `$${after.toFixed(2)}`],
            ] as [string, ReactNode][]).map(([label, v]) => (
              <div key={label} className="flex justify-between gap-3 px-3 py-2.5">
                <dt className="text-[#8A8A8A]">{label}</dt>
                <dd className="text-[#1F1D1D] font-medium text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <label className="flex items-center gap-2 text-[14px] text-[#1F1D1D] cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="accent-[#3E3EDF]" />
            I confirm this payout information is mine.
          </label>
          {error && (
            <p className="text-[13px] text-[#E65353]">
              {error}{" "}
              {smsRequired && (
                <button onClick={() => { setCode(""); setStep("sms"); }} className="underline cursor-pointer">Enter the code again</button>
              )}
            </p>
          )}
          <button disabled={!confirmed || busy} onClick={() => void submit()} className={primary}>
            {busy ? "Requesting…" : `Request $${value.toFixed(2)}`}
          </button>
          <p className="text-[12px] text-[#8A8A8A] text-center">Processing times may vary.</p>
        </div>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className={shell}>
        <div className={`${card} text-center`}>
          <h3 className="text-[18px] font-semibold text-[#1F1D1D]">Additional review needed</h3>
          <p className="text-[14px] text-[#575757]">
            Your withdrawal needs a quick review by Nibbl before it can be processed. No action is needed unless we contact you.
          </p>
          <button onClick={() => setStep("done")} className={primary}>Got it</button>
        </div>
      </div>
    );
  }

  // done — Master: shopper-facing status is Requested, Processing or Paid.
  const processing = Boolean(result?.needs_review);
  const steps = [
    { label: "Requested", at: result?.created_at, done: true },
    { label: "Processing", current: processing },
    { label: "Paid" },
  ];
  return (
    <div className={shell}>
      <div className={card}>
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="w-12 h-12 rounded-full bg-[#EEF0FF] text-[#3E3EDF] text-[22px] flex items-center justify-center"><Check className="w-6 h-6" strokeWidth={3} /></span>
          <h3 className="text-[18px] font-semibold text-[#1F1D1D]">Withdrawal requested</h3>
          <span className="text-[26px] font-semibold text-[#1F1D1D]">${value.toFixed(2)}</span>
          <span className="text-[13px] text-[#8A8A8A]">to {providerName(method)} · {method?.handle}</span>
        </div>
        <ol className="flex flex-col gap-2 px-2">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                s.done ? "bg-[#3E3EDF] text-white" : s.current ? "border-2 border-[#3E3EDF]" : "border-2 border-gray-200"
              }`}>{s.done ? <Check className="w-3 h-3" strokeWidth={3} /> : null}</span>
              <span className={`text-[14px] ${s.done || s.current ? "text-[#1F1D1D] font-medium" : "text-[#8A8A8A]"}`}>
                {s.label}
                {s.at ? <span className="ml-2 text-[12px] font-normal text-[#8A8A8A]">{new Date(String(s.at)).toLocaleString()}</span> : null}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-[13px] text-[#575757] text-center">We&apos;ll update your Wallet when your payment status changes.</p>
        <button onClick={onViewActivity} className={primary}>View Wallet Activity</button>
        <button onClick={onClose} className={secondary}>Done</button>
      </div>
    </div>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex justify-between items-center">
      <h3 className="text-[18px] font-semibold text-[#1F1D1D]">{title}</h3>
      <button onClick={onClose} aria-label="Close" className="text-[#8A8A8A] cursor-pointer"><X className="w-5 h-5" /></button>
    </div>
  );
}
