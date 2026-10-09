"use client";

import { useState } from "react";

interface LocationGateProps {
  onSave: (body: { zip?: string; lat?: number; lng?: number }) => Promise<void>;
  onCancel?: () => void;
}

/** Master "Find deals near you": discovery deals appear only after the
 *  shopper's location (device) or ZIP is known. */
export default function LocationGate({ onSave, onCancel }: LocationGateProps) {
  const [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (body: { zip?: string; lat?: number; lng?: number }) => {
    setBusy(true);
    setError("");
    try {
      await onSave(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't use that location.");
    } finally {
      setBusy(false);
    }
  };

  const allowLocation = () => {
    if (!navigator.geolocation) {
      setError("Location isn't available in this browser. Enter your ZIP code instead.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => void save({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setBusy(false);
        setError("Location permission was declined. Enter your ZIP code instead.");
      },
      { timeout: 10000 }
    );
  };

  return (
    <div className="w-full max-w-[560px] mx-auto bg-white shadow-[0px_4px_11.5px_rgba(0,0,0,0.08)] rounded-[12px] p-6 flex flex-col gap-4 text-center">
      <h2 className="text-[24px] font-semibold text-[#1F1D1D]">Find deals near you</h2>
      <p className="text-[14px] text-[#4D4D4D]">Allow location or enter your ZIP code to see eligible deals.</p>
      <p className="text-[12px] text-[#575757]">Claim → Buy → Submit Receipt → Get Cash Back</p>
      <button
        onClick={allowLocation}
        disabled={busy}
        className="h-[44px] bg-[#3E3EDF] text-white text-[15px] font-medium rounded-lg disabled:opacity-50 cursor-pointer"
      >
        Allow Location
      </button>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d{5}$/.test(zip)) void save({ zip });
          else setError("Enter a 5-digit ZIP code.");
        }}
      >
        <input
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          inputMode="numeric"
          placeholder="Enter ZIP Code"
          className="flex-1 h-[44px] border border-[#E0E0E0] rounded-lg px-3 text-[15px] outline-none focus:border-[#3E3EDF]"
        />
        <button type="submit" disabled={busy} className="h-[44px] px-5 border border-[#3E3EDF] text-[#3E3EDF] rounded-lg font-medium disabled:opacity-50 cursor-pointer">
          Go
        </button>
      </form>
      {error && <p className="text-[13px] text-[#E65353]">{error}</p>}
      {onCancel && (
        <button onClick={onCancel} className="text-[13px] text-[#575757] underline cursor-pointer">
          Cancel
        </button>
      )}
    </div>
  );
}
