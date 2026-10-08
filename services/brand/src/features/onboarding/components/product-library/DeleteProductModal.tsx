import { useState } from "react";

interface DeleteProductModalProps {
  productName: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

const CONFIRM_WORD = "DELETE";

export default function DeleteProductModal({
  productName,
  onClose,
  onConfirm,
}: DeleteProductModalProps) {
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canDelete = typed.trim().toUpperCase() === CONFIRM_WORD;

  const handleConfirm = async () => {
    if (!canDelete || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-jakarta">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-[480px] flex flex-col overflow-hidden animate-scale-in border border-slate-100/50">
        <div className="p-8 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-extrabold text-[#131B2E]">Delete this product?</h2>
            <p className="text-sm font-medium text-[#454656] leading-relaxed font-manrope">
              <span className="font-bold text-[#131B2E]">{productName}</span> will be
              removed from your library. Past reviews and redemptions are kept for your
              records — this only stops the product from being used in new campaigns.
            </p>
          </div>

          <div className="flex flex-col gap-2 font-manrope">
            <label className="text-xs font-bold text-[#454656]">
              Type <span className="text-[#FF2D31] font-extrabold">{CONFIRM_WORD}</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleConfirm();
              }}
              autoFocus
              placeholder={CONFIRM_WORD}
              className="w-full h-11 px-4 rounded-xl border border-[#C5C5D9]/40 text-sm font-semibold text-[#131B2E] outline-none focus:border-[#FF2D31] focus:ring-2 focus:ring-[#FF2D31]/15"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-6 h-11 bg-white hover:bg-slate-50 text-[#454656] border border-[#C5C5D9]/40 font-bold text-sm rounded-full transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canDelete || submitting}
              className="px-6 h-11 bg-[#FF2D31] hover:bg-red-600 text-white font-bold text-sm rounded-full transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Deleting…" : "Delete Product"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
