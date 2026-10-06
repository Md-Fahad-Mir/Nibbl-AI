"use client";

import React, { useEffect, useState } from "react";
import { ApiError, ApiRecord, nibblApi } from "@/lib/api/backendApi";
import { RichTextEditor } from "./RichTextEditor";

interface PrivacyPolicyViewProps {
  onBack: () => void;
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({
  onBack,
}) => {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadPrivacyPolicy = async () => {
      setIsLoading(true);
      setError("");
      try {
        const document = await nibblApi.adminPrivacyPolicy();
        if (!cancelled) setContent(recordString(document, "content"));
      } catch (loadError) {
        if (!cancelled) setError(readError(loadError));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const timer = window.setTimeout(() => {
      void loadPrivacyPolicy();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const handleSave = async (newValue: string) => {
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const document = await nibblApi.updateAdminPrivacyPolicy(newValue);
      setContent(recordString(document, "content"));
      setMessage("Privacy policy updated.");
    } catch (saveError) {
      setError(readError(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 font-inter">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-[#1F1D1D] hover:text-[#3E3EDF] transition-colors cursor-pointer"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h2 className="text-[20px] sm:text-[24px] font-medium text-[#1F1D1D]">
          Privacy Policy
        </h2>
      </div>

      {error && (
        <div className="rounded-[8px] border border-red-100 bg-red-50 px-4 py-3 text-[14px] font-medium text-red-600">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-[8px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-[14px] font-medium text-emerald-700">
          {message}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-[12px] border border-gray-100 bg-white p-6 text-center text-[15px] leading-6 text-[#575757] shadow-[0px_2px_8px_rgba(0,0,0,0.06)]">
          Loading privacy policy...
        </div>
      ) : (
        <RichTextEditor
          initialValue={content}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </div>
  );
};

const recordString = (record: ApiRecord, key: string) =>
  typeof record[key] === "string" ? record[key] : "";

const readError = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : "Something went wrong.";
