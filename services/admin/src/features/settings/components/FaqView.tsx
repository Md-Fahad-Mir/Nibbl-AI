"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ApiError, ApiRecord, nibblApi } from "@/lib/api/backendApi";
import { AddFaqForm, FaqItem } from "./AddFaqForm";

interface FaqViewProps {
  onBack: () => void;
}

export const FaqView: React.FC<FaqViewProps> = ({ onBack }) => {
  const [isEditingFaq, setIsEditingFaq] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<AdminFaq | null>(null);
  const [faqs, setFaqs] = useState<AdminFaq[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadFaqs = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await nibblApi.adminFaqs();
      setFaqs(response.map(toAdminFaq));
    } catch (loadError) {
      setError(readError(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFaqs();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadFaqs]);

  const handleSubmitFaq = async (faq: FaqItem) => {
    setError("");
    setMessage("");
    try {
      if (faq.id) {
        await nibblApi.updateAdminFaq(faq.id, {
          question: faq.question,
          answer: faq.answer,
        });
        setMessage("FAQ updated.");
      } else {
        await nibblApi.createAdminFaq({
          question: faq.question,
          answer: faq.answer,
          sort_order: faqs.length + 1,
          is_active: true,
        });
        setMessage("FAQ created.");
      }
      await loadFaqs();
      setIsEditingFaq(false);
      setSelectedFaq(null);
    } catch (saveError) {
      setError(readError(saveError));
    }
  };

  const handleDeleteFaq = async (faqId: string) => {
    if (!window.confirm("Delete this FAQ?")) return;

    setError("");
    setMessage("");
    try {
      await nibblApi.deleteAdminFaq(faqId);
      setMessage("FAQ deleted.");
      await loadFaqs();
    } catch (deleteError) {
      setError(readError(deleteError));
    }
  };

  if (isEditingFaq) {
    return (
      <div className="flex w-full flex-col gap-4">
        {error && (
          <div className="rounded-[8px] border border-red-100 bg-red-50 px-4 py-3 text-[14px] font-medium text-red-600">
            {error}
          </div>
        )}
        <AddFaqForm
          initialFaq={selectedFaq}
          onBack={() => {
            setIsEditingFaq(false);
            setSelectedFaq(null);
          }}
          onConfirm={handleSubmitFaq}
        />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 font-inter">
      <div className="flex flex-wrap items-center justify-between gap-4">
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
            FAQ
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setError("");
            setSelectedFaq(null);
            setIsEditingFaq(true);
          }}
          className="h-[44px] rounded-[8px] bg-[#3E3EDF] px-6 text-[15px] font-medium text-white shadow-md transition-colors hover:bg-[#3232C7]"
        >
          Add FAQ
        </button>
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

      {isLoading && (
        <div className="rounded-[12px] border border-gray-100 bg-white p-6 text-center text-[15px] leading-6 text-[#575757] shadow-[0px_2px_8px_rgba(0,0,0,0.06)]">
          Loading FAQ records...
        </div>
      )}

      {!isLoading && faqs.length === 0 && !error && (
        <div className="rounded-[12px] border border-gray-100 bg-white p-6 text-center text-[15px] leading-6 text-[#575757] shadow-[0px_2px_8px_rgba(0,0,0,0.06)]">
          No FAQ records have been created yet.
        </div>
      )}

      {!isLoading && faqs.length > 0 && (
        <div className="flex w-full flex-col gap-3">
          {faqs.map((faq) => (
            <div
              key={faq.id}
              className="rounded-[12px] border border-gray-100 bg-white p-5 shadow-[0px_2px_8px_rgba(0,0,0,0.06)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[16px] font-medium leading-6 text-[#1F1D1D]">
                      {faq.question}
                    </h3>
                    <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${
                      faq.is_active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {faq.is_active ? "Active" : "Hidden"}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-[14px] leading-6 text-[#575757]">
                    {faq.answer}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setMessage("");
                      setSelectedFaq(faq);
                      setIsEditingFaq(true);
                    }}
                    className="h-[36px] rounded-[8px] border border-[#3E3EDF] px-4 text-[14px] font-medium text-[#3E3EDF] transition-colors hover:bg-[#F3F3FF]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteFaq(faq.id)}
                    className="h-[36px] rounded-[8px] border border-red-200 px-4 text-[14px] font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface AdminFaq extends FaqItem {
  id: string;
  sort_order: number;
  is_active: boolean;
}

const toAdminFaq = (item: ApiRecord, index: number): AdminFaq => ({
  id: String(item.id ?? index),
  question: String(item.question ?? "Untitled question"),
  answer: String(item.answer ?? ""),
  sort_order: Number(item.sort_order ?? index),
  is_active: Boolean(item.is_active ?? true),
});

const readError = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : "Something went wrong.";
