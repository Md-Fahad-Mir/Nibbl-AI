"use client";

import React, { useState } from "react";

export interface FaqItem {
  id?: string;
  question: string;
  answer: string;
}

interface AddFaqFormProps {
  initialFaq?: FaqItem | null;
  onBack: () => void;
  onConfirm: (faq: { question: string; answer: string; id?: string }) => void | Promise<void>;
}

export const AddFaqForm: React.FC<AddFaqFormProps> = ({
  initialFaq,
  onBack,
  onConfirm,
}) => {
  const [question, setQuestion] = useState(initialFaq?.question || "");
  const [answer, setAnswer] = useState(initialFaq?.answer || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setIsSubmitting(true);
    try {
      await onConfirm({
        id: initialFaq?.id,
        question: question.trim(),
        answer: answer.trim(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[500px] flex flex-col gap-6 font-inter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-[#1F1D1D] hover:text-[#3E3EDF] transition-colors cursor-pointer"
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
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h2 className="text-[20px] sm:text-[24px] font-medium text-[#1F1D1D]">
          {initialFaq ? "Edit FAQ" : "Add FAQ"}
        </h2>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
        {/* Question Field */}
        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-medium text-[#1F1D1D]">
            Question
          </label>
          <div className="w-full h-[56px] px-4 bg-[#FEFEFE] border border-[#3E3EDF] rounded-[8px] flex items-center focus-within:border-[#3E3EDF]">
            <input
              type="text"
              required
              placeholder="How do i book a service App?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full bg-transparent outline-none text-[15px] text-[#1F1D1D] placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Answer Field */}
        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-medium text-[#1F1D1D]">
            Answer
          </label>
          <div className="w-full p-4 bg-[#FEFEFE] border border-[#3E3EDF] rounded-[8px] focus-within:border-[#3E3EDF]">
            <textarea
              required
              rows={5}
              placeholder="Enter description...."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full bg-transparent outline-none text-[15px] text-[#1F1D1D] placeholder:text-gray-400 resize-y"
            />
          </div>
        </div>

        {/* Confirm Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-[48px] bg-[#3E3EDF] hover:bg-[#3232C7] disabled:cursor-not-allowed disabled:opacity-60 text-white font-medium text-[16px] rounded-[8px] transition-colors cursor-pointer shadow-md mt-2"
        >
          {isSubmitting ? "Saving..." : "Confirm"}
        </button>
      </form>
    </div>
  );
};
