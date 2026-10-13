"use client";

import { useState } from "react";
import { nibblApi } from "@/lib/api/backendApi";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";

interface EmailCodeFormProps {
  /** Pre-filled email (Reserve Offer). */
  initialEmail?: string;
  /** The parent already sent the code to `initialEmail` — start at the code step. */
  codeSent?: boolean;
  /** Reserve Offer while logged out: create the shopper account if new. */
  create?: boolean;
  /** Contact phone typed on Reserve Offer (kept if the shopper has none). */
  phone?: string;
  phoneCountry?: string;
  onSignedIn: () => void;
  onCancel?: () => void;
}

// The API never reveals which emails have accounts (brand and Nibbl team
// accounts sign in elsewhere), so the wording mustn't promise a code arrived.
const sentNotice = (email: string, create: boolean) =>
  create
    ? `We sent a 6-digit code to ${email}. Check your inbox (and spam). ` +
      "No code? Brand and Nibbl team emails can't be used to shop — use your personal email."
    : `If ${email} has a Nibbl shopper account, we sent it a 6-digit code. Check your inbox (and spam). ` +
      "Brand and Nibbl team accounts sign in on their own sites.";

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/** Passwordless shopper sign-in: email → 6-digit code → signed in. */
export default function EmailCodeForm({
  initialEmail = "", codeSent = false, create = false, phone = "", phoneCountry = "", onSignedIn, onCancel,
}: EmailCodeFormProps) {
  const signInWithEmailCode = useConsumerApiStore((s) => s.signInWithEmailCode);
  const [email, setEmail] = useState(initialEmail);
  const [step, setStep] = useState<"email" | "code">(codeSent && initialEmail ? "code" : "email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(codeSent && initialEmail ? sentNotice(initialEmail, create) : "");

  const send = async () => {
    if (!email.trim()) return setError("Enter your email address.");
    setBusy(true);
    setError("");
    try {
      await nibblApi.requestEmailCode(email.trim(), create);
      setStep("code");
      setNotice(sentNotice(email.trim(), create));
    } catch (err) {
      setError(errorText(err, "Could not send the code."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.trim().length !== 6) return setError("Enter the 6-digit code.");
    setBusy(true);
    setError("");
    try {
      await signInWithEmailCode(email.trim(), code.trim(), phone, phoneCountry);
      onSignedIn();
    } catch (err) {
      setError(errorText(err, "Invalid or expired code."));
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full h-[44px] px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#3E3EDF] text-gray-800";
  const primary = "w-full h-[48px] text-white font-medium text-sm rounded-lg bg-[#3E3EDF] hover:bg-[#3232c4] disabled:opacity-60 cursor-pointer";

  return (
    <div className="flex flex-col gap-3">
      {step === "email" ? (
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex flex-col gap-3">
          <label className="text-xs font-medium text-gray-700">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className={input} />
          <button type="submit" disabled={busy} className={primary}>{busy ? "Sending…" : "Email me a sign-in code"}</button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void verify(); }} className="flex flex-col gap-3">
          {notice && <p className="text-sm text-gray-600">{notice}</p>}
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code"
            className={`${input} text-center tracking-[0.4em] text-lg`} />
          <button type="submit" disabled={busy} className={primary}>{busy ? "Checking…" : "Continue"}</button>
          <button type="button" disabled={busy} onClick={() => void send()} className="text-xs text-[#3E3EDF] font-medium cursor-pointer">
            Resend code
          </button>
        </form>
      )}
      {error && <p className="text-xs font-medium text-[#E65353]">{error}</p>}
      {onCancel && (
        <button type="button" onClick={onCancel} className="text-xs text-gray-500 underline cursor-pointer">Cancel</button>
      )}
    </div>
  );
}
