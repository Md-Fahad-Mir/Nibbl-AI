"use client";

import React from "react";
import { BrandDetail } from "@/types/brand.types";

interface BrandDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  brand?: BrandDetail | null;
}

export const BrandDetailsModal: React.FC<BrandDetailsModalProps> = ({
  isOpen,
  onClose,
  brand,
}) => {
  if (!isOpen || !brand) return null;

  const data: BrandDetail = brand;
  const isApplication = data.source === "brand-application";
  const websiteUrl = data.website || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      {/* Modal Container */}
      <div className="relative w-full max-w-[513px] bg-[#FEFEFE] shadow-[0px_4px_29.1px_rgba(0,0,0,0.2)] rounded-[12px] p-6 flex flex-col gap-6">
        {/* Top Header + Close Button */}
        <div className="w-full flex items-center justify-between">
          <h2 className="font-inter text-[24px] font-semibold leading-[29px] text-[#1F1D1D]">
            Brand Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 2 Column Details Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 font-inter text-[14px]">
          {/* Left Column */}
          <div className="flex flex-col gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1">
              <span className="font-medium text-[#575757] text-[16px]">
                {isApplication ? "Applicant Brand Name" : "Brand Name"}
              </span>
              <span className="font-medium text-[#959595]">{data.name || "Not returned"}</span>
            </div>

            {!isApplication && (
              <div className="flex flex-col gap-1">
                <span className="font-medium text-[#575757] text-[16px]">Legal Name</span>
                <span className="font-medium text-[#959595]">{data.legalName || "Not returned"}</span>
              </div>
            )}

            {!isApplication && (
              <div className="flex flex-col gap-1">
                <span className="font-medium text-[#575757] text-[16px]">Slug</span>
                <span className="font-medium text-[#959595]">{data.slug || "Not returned"}</span>
              </div>
            )}

            {/* Created Date */}
            <div className="flex flex-col gap-1">
              <span className="font-medium text-[#575757] text-[16px]">Created Date</span>
              <span className="font-medium text-[#959595]">
                {data.date || "Not returned"}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-medium text-[#575757] text-[16px]">Status</span>
              <span className="font-medium text-[#959595]">
                {data.status || "Not returned"}
              </span>
            </div>

            {isApplication && (
              <div className="flex flex-col gap-1">
                <span className="font-medium text-[#575757] text-[16px]">Requested Plan</span>
                <span className="font-medium text-[#959595]">
                  {data.requestedPlan || "Not returned"}
                </span>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-1">
              <span className="font-medium text-[#575757] text-[16px]">Contact Email</span>
              <span className="font-medium text-[#959595]">
                {data.email || "Not returned"}
              </span>
            </div>

            {!isApplication && (
              <div className="flex flex-col gap-1">
                <span className="font-medium text-[#575757] text-[16px]">Plan</span>
                <span className="font-medium text-[#959595]">
                  {data.planName || "Not returned"}
                </span>
              </div>
            )}

            {/* Website URL */}
            <div className="flex flex-col gap-1">
              <span className="font-medium text-[#575757] text-[14px] truncate">
                Website URL
              </span>
              <span className="font-medium text-[#959595] truncate">
                {websiteUrl || "Not returned"}
              </span>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <span className="font-medium text-[#575757] text-[16px]">
                {isApplication ? "Message" : "Description"}
              </span>
              <span className="font-medium text-[#959595] truncate">
                {data.description || "Not returned"}
              </span>
            </div>

            {isApplication && (
              <div className="flex flex-col gap-1">
                <span className="font-medium text-[#575757] text-[16px]">Decision Reason</span>
                <span className="font-medium text-[#959595] truncate">
                  {data.decisionReason || "Not returned"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Full Row: Website Link */}
        <div className="w-full flex items-end justify-between pt-2 border-t border-gray-100 font-inter text-[14px]">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-[#1F1D1D]">Website</span>
            <span className="font-medium text-[#575757] text-[13px]">
              {websiteUrl || "Not returned"}
            </span>
          </div>

          <a
            href={websiteUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-medium text-[#000000] underline hover:opacity-80 transition-opacity ${
              websiteUrl ? "" : "pointer-events-none opacity-50"
            }`}
          >
            Click here
          </a>
        </div>
      </div>
    </div>
  );
};
