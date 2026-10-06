/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";

interface RedemptionItem {
  id: string;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  userIdCode: string;
  redemptionsCount: number;
  reviewsCount: number;
  campaignName: string;
  subBrand: string;
  receiptThumbnailUrl: string;
  claimedTierLabel: string;
  claimedTierValue: string;
  submittedDate: string;
  submittedTime: string;
  receiptId?: string;
  receiptImageUrl?: string;
  receiptMerchant?: string;
  receiptPurchasedAt?: string;
  receiptTotal?: string;
  receiptLineItems?: Record<string, unknown>[];
  status: "Pending" | "Approved" | "Rejected" | "Expired" | "Manual Review";
  issue?: string;
  priority?: "High" | "Medium";
}

interface RedemptionDrawerProps {
  redemption: RedemptionItem;
  onClose: () => void;
  onApprove: (id: string) => void;
}

export default function RedemptionDrawer({ redemption, onClose, onApprove }: RedemptionDrawerProps) {
  const [zoom, setZoom] = useState(1.0);
  const [notes, setNotes] = useState("Receipt was exceptionally clear. Verified Kettle Sea Salt chips manually to confirm OCR.");
  const receiptImageUrl = redemption.receiptImageUrl || redemption.receiptThumbnailUrl;
  const highlightedLineItem = redemption.receiptLineItems?.[0];
  const lineItemDescription = String(
    highlightedLineItem?.description ?? "No line item extracted"
  );
  const lineItemSku = String(
    highlightedLineItem?.matched_product_name ??
      highlightedLineItem?.matched_product ??
      "Unmatched item"
  );
  const lineItemPrice =
    highlightedLineItem?.unit_price != null
      ? `$${Number(highlightedLineItem.unit_price).toFixed(2)}`
      : "";

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 1.8));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.6));
  const handleResetZoom = () => setZoom(1.0);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-50 transition-opacity"></div>

      {/* Drawer Panel */}
      <div className="fixed top-0 right-0 h-screen w-full max-w-[850px] bg-[#FAF8FF] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] border-l border-[#C5C5D9]/20 z-50 flex flex-col md:flex-row transition-transform duration-300 font-manrope animate-slide-left">
        
        {/* Left Section: Receipt scan preview */}
        <div className="w-full md:w-[427px] h-full bg-[#F2F3FF] border-r border-[#C5C5D9]/20 flex flex-col">
          {/* Zoom controls header */}
          <div className="h-[81px] border-b border-[#C5C5D9]/20 px-6 flex justify-between items-center bg-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">🛍️</span>
              <span className="font-bold text-[#131B2E] text-sm">Receipt Scan</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={handleZoomOut} className="w-8 h-8 rounded-full bg-[#E2E7FF] hover:bg-[#D0D7FF] font-extrabold flex items-center justify-center border-none cursor-pointer text-[#001BD2]">-</button>
              <button onClick={handleZoomIn} className="w-8 h-8 rounded-full bg-[#E2E7FF] hover:bg-[#D0D7FF] font-extrabold flex items-center justify-center border-none cursor-pointer text-[#001BD2]">+</button>
              <button onClick={handleResetZoom} className="w-8 h-8 rounded-full bg-[#E2E7FF] hover:bg-[#D0D7FF] font-bold text-xs flex items-center justify-center border-none cursor-pointer text-[#001BD2]">1:1</button>
            </div>
          </div>

          {/* Receipt Canvas */}
          <div className="flex-1 bg-[#EEF0FF] p-8 flex items-center justify-center overflow-auto relative">
            <img
              src={receiptImageUrl}
              alt="Receipt Preview"
              className="max-w-[280px] shadow-2xl rounded border border-slate-200/50 object-contain transition-transform duration-100 ease-out"
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        </div>

        {/* Right Section: Utility form panel */}
        <div className="flex-1 h-full flex flex-col bg-white">
          {/* Close Header */}
          <div className="h-[81px] px-8 py-6 flex justify-between items-center border-b border-[#C5C5D9]/15 flex-shrink-0">
            <div className="flex flex-col text-left">
              <span className="bg-[#001BD2]/5 text-[#001BD2] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wider uppercase w-fit">
                MANUAL AUDIT
              </span>
              <h3 className="font-jakarta font-extrabold text-xl text-[#131B2E] tracking-tight mt-1">
                Review Receipt #TXN-9402
              </h3>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-50 border-none cursor-pointer flex items-center justify-center text-lg font-bold text-[#131B2E]">
              ✕
            </button>
          </div>

          {/* Form Scrollable Body */}
          <div className="flex-1 p-8 overflow-y-auto flex flex-col gap-6 text-left">
            {/* Campaign info card */}
            <div className="bg-[#F2F3FF] border border-[#C5C5D9]/10 rounded-2xl p-5 flex items-center gap-4 flex-shrink-0">
              <div className="w-10 h-10 bg-[#2D3FEA] rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0">🔥</div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[#131B2E]">{redemption.campaignName}</span>
                <span className="text-xs text-[#454656] font-medium mt-0.5">{redemption.subBrand}</span>
              </div>
            </div>

            {/* OCR Cards Grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Store Name", val: redemption.receiptMerchant || redemption.subBrand },
                { label: "Date & Time", val: `${redemption.submittedDate} • ${redemption.submittedTime}` },
                { label: "Receipt ID", val: redemption.receiptId || redemption.id },
                { label: "Extracted Total", val: redemption.receiptTotal || redemption.claimedTierValue, class: "text-[#001BD2]" },
              ].map((c, i) => (
                <div key={i} className="bg-white border border-[#C5C5D9]/15 rounded-xl p-4 flex flex-col justify-center gap-1 shadow-sm">
                  <span className="text-[10px] font-bold text-[#454656]/60 tracking-wider uppercase leading-none">{c.label}</span>
                  <span className={`text-sm font-bold text-[#131B2E] mt-1 ${c.class || ""}`}>{c.val}</span>
                </div>
              ))}
            </div>

            {/* Line Item Alerts */}
            <div className="bg-[#FDF2F2] border border-[#BA1A1A]/10 p-5 rounded-2xl flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <img src="/redemption/warningIcon.svg" alt="Warning" className="w-4 h-4 object-contain" />
                  <span className="font-bold text-[#BA1A1A] text-xs uppercase tracking-wider">Line Item Alert</span>
                </div>
                <span className="bg-[#001BD2] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest leading-none">Reward Item</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-[#BA1A1A]/5">
                <div className="flex flex-col text-left">
                  <span className="text-sm font-extrabold text-[#131B2E]">{lineItemDescription}</span>
                  <span className="text-xs text-[#454656] mt-0.5">{lineItemSku}</span>
                </div>
                <span className="font-bold text-[#131B2E]">{lineItemPrice}</span>
              </div>
            </div>

            {/* Feedback note text area */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#454656] uppercase tracking-wider">Auditor Feedback</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for rejection or internal notes..."
                rows={3}
                className="w-full bg-[#FAF8FF] border border-slate-200 rounded-xl p-4 text-sm font-medium focus:outline-none focus:border-[#001BD2] text-[#131B2E] placeholder-[#454656]/40 resize-none"
              />
            </div>
          </div>

          {/* Sticky CTA Footer */}
          <div className="p-8 border-t border-[#C5C5D9]/15 flex-shrink-0">
            <button
              onClick={() => onApprove(redemption.id)}
              className="w-full h-12 bg-gradient-to-r from-[#001BD2] to-[#2D3FEA] hover:opacity-95 text-white font-extrabold text-sm rounded-full flex items-center justify-center gap-2 border-none cursor-pointer shadow-[0px_8px_16px_rgba(0,27,210,0.15)] transition-all"
            >
              ✓ Approve & Reward
            </button>
          </div>
        </div>

      </div>
    </>
  );
}
