"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, ApiRecord } from "@/lib/api/backendApi";
import { useConsumerApiStore } from "@/stores/useConsumerApiStore";
import { AlertTriangle, CalendarX, Camera, CheckCircle2, Clock, ReceiptText, Store, X, XCircle } from "lucide-react";

interface ReceiptSubmitFlowProps {
  reservation: ApiRecord;
  onClose: () => void;
  onNavigate: (tab: "offer" | "wallet" | "scan") => void;
}

type Step = "requirements" | "photo" | "review" | "checking" | "outcome";
type Outcome =
  | { kind: "verified"; receipt: ApiRecord }
  | { kind: "manual" }
  | { kind: "unreadable"; message: string }
  | { kind: "date" | "retailer"; message: string }
  | { kind: "final"; message: string }
  | { kind: "error"; message: string };

const shell = "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4";
const card = "w-full max-w-[440px] max-h-[90vh] overflow-y-auto bg-white rounded-[16px] p-6 flex flex-col gap-4";
const primary = "h-11 rounded-[10px] bg-[#3E3EDF] text-white text-[15px] font-medium cursor-pointer disabled:opacity-50";
const secondary = "h-11 rounded-[10px] bg-[#EEF0FF] text-[#3E3EDF] text-[15px] font-medium cursor-pointer";
const when = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

const Header = ({ text, onClose }: { text: string; onClose: () => void }) => (
  <div className="flex justify-between items-start">
    <h3 className="text-[20px] font-semibold text-[#1F1D1D]">{text}</h3>
    <button onClick={onClose} aria-label="Close" className="text-[#8A8A8A] cursor-pointer"><X className="w-5 h-5" /></button>
  </div>
);

/** Master "Receipt Submission" + "Receipt Outcomes": requirements → take or
 *  choose a photo → review before submit → the outcome for that receipt. */
export default function ReceiptSubmitFlow({ reservation, onClose, onNavigate }: ReceiptSubmitFlowProps) {
  const uploadReceipt = useConsumerApiStore((s) => s.uploadReceipt);
  const [step, setStep] = useState<Step>("requirements");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const req = (reservation.receipt_requirements ?? {}) as ApiRecord;
  const products = (Array.isArray(req.products) ? req.products : []) as string[];
  const retailers = (Array.isArray(req.retailers) ? req.retailers : []) as string[];
  const title = String(reservation.offer_headline || reservation.product_name || "Your offer");
  const isResubmission = Number(reservation.resubmissions_left ?? 1) === 0 && Boolean(reservation.last_receipt_rejection);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = (chosen: File | undefined) => {
    if (!chosen) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
    setStep("review");
  };

  const submit = async () => {
    if (!file) return;
    setStep("checking");
    try {
      const receipt = await uploadReceipt(String(reservation.id), file);
      setOutcome(String(receipt.status) === "verified" ? { kind: "verified", receipt } : { kind: "manual" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Receipt upload failed.";
      const code = err instanceof ApiError ? (err.data as { code?: string } | null)?.code : undefined;
      if (err instanceof ApiError && err.status === 422) setOutcome({ kind: "unreadable", message });
      else if (code === "date_rejected") setOutcome({ kind: "date", message });
      else if (code === "retailer_rejected") setOutcome({ kind: "retailer", message });
      else if (code === "final_rejection") setOutcome({ kind: "final", message });
      else setOutcome({ kind: "error", message });
    }
    setStep("outcome");
  };

  const retry = () => {
    setFile(null);
    setOutcome(null);
    setStep("photo");
  };

  const inputs = (
    <>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={gallery} type="file" accept="image/*" className="hidden"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </>
  );

  if (step === "requirements") {
    const items: [string, string][] = [
      ["Purchase after reservation", `Items must be purchased on or after ${when(req.purchase_after)}.`],
      ["Submit by the deadline", `Your receipt must be submitted by ${when(req.submit_by || reservation.expires_at)}.`],
      ["Eligible product", products.length ? products.join(", ") : title],
      ["Required quantity", `Purchase at least ${String(req.required_quantity ?? 1)} eligible item${Number(req.required_quantity ?? 1) === 1 ? "" : "s"}.`],
      ["Required retailer", retailers.length ? retailers.join(", ") : "Any retailer — the receipt just needs to show the eligible product."],
      ["Clear, full receipt", "Photograph the entire receipt so all details are visible."],
      ["Item price visible", "The receipt must show the price for the eligible item(s)."],
    ];
    return (
      <div className={shell}>
        <div className={card}>
          <Header text="Receipt Requirements" onClose={onClose} />
          <p className="text-[13px] text-[#575757]">Make sure your receipt meets all requirements before submitting.</p>
          {isResubmission && (
            <p className="text-[13px] text-[#B26A00] bg-[#FFF4E0] rounded-[8px] p-3">
              Your first receipt didn&apos;t qualify: {String(reservation.last_receipt_rejection)} This is your one
              resubmission — your original deadline still applies.
            </p>
          )}
          <ol className="flex flex-col gap-2">
            {items.map(([label, text], i) => (
              <li key={label} className="flex gap-3 bg-[#F6F6FB] rounded-[8px] p-3">
                <span className="w-6 h-6 rounded-full bg-[#3E3EDF] text-white text-[12px] flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div>
                  <div className="text-[14px] font-medium text-[#1F1D1D]">{label}</div>
                  <div className="text-[12px] text-[#575757]">{text}</div>
                </div>
              </li>
            ))}
          </ol>
          <button onClick={() => setStep("photo")} className={primary}>Continue</button>
        </div>
      </div>
    );
  }

  if (step === "photo") {
    return (
      <div className={shell}>
        <div className={card}>
          <Header text="Add Your Receipt" onClose={onClose} />
          <p className="text-[13px] text-[#575757]">Photograph the entire receipt clearly.</p>
          <button onClick={() => camera.current?.click()}
            className="h-44 rounded-[12px] border-2 border-dashed border-[#C9CCF5] bg-[#F6F6FB] text-[14px] text-[#575757] cursor-pointer">
            <Camera className="w-8 h-8 mx-auto mb-2 text-[#3E3EDF]" />
            Take a clear photo of the entire receipt so all details are visible.
          </button>
          <button onClick={() => camera.current?.click()} className={primary}>Take Photo</button>
          <button onClick={() => gallery.current?.click()} className={secondary}>Choose Photo</button>
          {inputs}
        </div>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className={shell}>
        <div className={card}>
          <Header text="Review Your Receipt" onClose={onClose} />
          <p className="text-[13px] text-[#575757]">Make sure the photo is clear and complete before submitting.</p>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your receipt" className="w-full max-h-[340px] object-contain rounded-[10px] border border-gray-100 bg-gray-50" />
          )}
          <div className="text-[13px]">
            <div className="text-[#8A8A8A]">Campaign</div>
            <div className="font-medium text-[#1F1D1D]">{title}</div>
            <div className="text-[#8A8A8A]">{String(reservation.brand_name ?? "")}</div>
          </div>
          <button onClick={() => void submit()} className={primary}>Submit Receipt</button>
          <button onClick={retry} className={secondary}>Retake</button>
          {inputs}
        </div>
      </div>
    );
  }

  if (step === "checking") {
    return (
      <div className={shell}>
        <div className={`${card} items-center text-center`}>
          <span className="w-14 h-14 rounded-full bg-[#EEF0FF] text-[#3E3EDF] text-[26px] flex items-center justify-center"><Clock className="w-7 h-7" /></span>
          <h3 className="text-[20px] font-semibold text-[#1F1D1D]">Receipt submitted</h3>
          <p className="text-[14px] text-[#575757]">We&apos;re checking your receipt now.</p>
        </div>
      </div>
    );
  }

  // Master Receipt Outcomes.
  const o = outcome ?? { kind: "error", message: "Something went wrong." };
  const views: Record<Outcome["kind"], { icon: React.ReactNode; title: string; body: React.ReactNode; actions: React.ReactNode }> = {
    verified: {
      icon: <CheckCircle2 className="w-8 h-8 text-[#00A671]" />,
      title: "Purchase verified.",
      body: (
        <>
          <p className="text-[14px] text-[#575757]">{title}</p>
          <p className="text-[13px] text-[#00875A] bg-[#E6F7F0] rounded-[8px] p-3">Your reward was added to your Wallet. Claim slot released.</p>
        </>
      ),
      actions: <button onClick={() => onNavigate("wallet")} className={primary}>View Wallet</button>,
    },
    manual: {
      icon: <Clock className="w-8 h-8 text-[#3E3EDF]" />,
      title: "Manual review",
      body: (
        <>
          <p className="text-[14px] text-[#575757]">We need a person to verify part of your receipt. You&apos;ll receive a response within 7 days.</p>
          <p className="text-[13px] text-[#575757] bg-[#F6F6FB] rounded-[8px] p-3">Your receipt was submitted successfully. Your claim remains active and its slot stays occupied.</p>
          <p className="text-[12px] text-[#8A8A8A]">Decision sent: you&apos;ll receive an in-app notification and an email confirmation when a decision is made.</p>
        </>
      ),
      actions: <button onClick={onClose} className={primary}>View My Offers</button>,
    },
    unreadable: {
      icon: <ReceiptText className="w-8 h-8 text-[#3E3EDF]" />,
      title: "We couldn't read the full receipt.",
      body: (
        <>
          <p className="text-[14px] text-[#575757]">Please submit a clearer photo showing the entire receipt.</p>
          <p className="text-[13px] text-[#575757] bg-[#F6F6FB] rounded-[8px] p-3">No receipt decision has been made. Your original deadline still applies.</p>
        </>
      ),
      actions: (
        <>
          <button onClick={() => { retry(); camera.current?.click(); }} className={primary}>Take Another Photo</button>
          <button onClick={() => { retry(); gallery.current?.click(); }} className={secondary}>Choose Another Photo</button>
        </>
      ),
    },
    date: {
      icon: <CalendarX className="w-8 h-8 text-[#E0700B]" />,
      title: "This receipt was purchased outside your eligible period.",
      body: (
        <>
          <p className="text-[13px] text-[#575757] bg-[#F6F6FB] rounded-[8px] p-3">
            Eligible purchase period: {when(req.purchase_after)} – {when(req.submit_by || reservation.expires_at)}
          </p>
          <p className="text-[13px] text-[#C0392B] bg-[#FDECEC] rounded-[8px] p-3">First rejection — one resubmission available before the original deadline.</p>
        </>
      ),
      actions: <button onClick={retry} className={primary}>Submit Different Receipt</button>,
    },
    retailer: {
      icon: <Store className="w-8 h-8 text-[#E0700B]" />,
      title: "This campaign requires a receipt from an eligible retailer.",
      body: (
        <>
          {retailers.length > 0 && (
            <p className="text-[13px] text-[#575757] bg-[#F6F6FB] rounded-[8px] p-3">Required retailers: {retailers.join(", ")}</p>
          )}
          <p className="text-[13px] text-[#C0392B] bg-[#FDECEC] rounded-[8px] p-3">First rejection — one resubmission available before the original deadline.</p>
        </>
      ),
      actions: <button onClick={retry} className={primary}>Submit Different Receipt</button>,
    },
    final: {
      icon: <XCircle className="w-8 h-8 text-[#E65353]" />,
      title: "This receipt still does not meet the campaign requirements.",
      body: (
        <>
          <p className="text-[14px] text-[#575757]">Your claim is now closed.</p>
          <p className="text-[13px] text-[#575757] bg-[#F6F6FB] rounded-[8px] p-3">Claim slot released.</p>
        </>
      ),
      actions: <button onClick={() => onNavigate("offer")} className={primary}>Explore More Offers</button>,
    },
    error: {
      icon: <AlertTriangle className="w-8 h-8 text-[#E0700B]" />,
      title: "We couldn't submit this receipt.",
      body: <p className="text-[14px] text-[#575757]">{"message" in o ? o.message : ""}</p>,
      actions: <button onClick={retry} className={primary}>Try Again</button>,
    },
  };
  const view = views[o.kind];
  return (
    <div className={shell}>
      <div className={`${card} text-center`}>
        <span className="mx-auto w-16 h-16 rounded-full bg-[#F6F6FB] text-[28px] flex items-center justify-center">{view.icon}</span>
        <h3 className="text-[20px] font-semibold text-[#1F1D1D]">{view.title}</h3>
        {view.body}
        {view.actions}
        {inputs}
      </div>
    </div>
  );
}
