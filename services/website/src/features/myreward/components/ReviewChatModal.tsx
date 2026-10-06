"use client";

import { useState } from "react";
import Image from "next/image";

export interface ReviewSubmission {
  content: string;
  rating: number;
  answers: { question: string; answer: string }[];
}

interface ReviewChatModalProps {
  itemName: string;
  onClose: () => void;
  onSubmit: (submission: ReviewSubmission) => void | Promise<void>;
}

export default function ReviewChatModal({
  itemName,
  onClose,
  onSubmit,
}: ReviewChatModalProps) {
  const reviewQuestions = [
    `How did you like the ${itemName}?`,
    "What did you like most: taste, texture, or ingredients?",
    "Would you purchase it again or recommend it to others?",
  ];
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<{ sender: "bot" | "user"; text: string }[]>([
    { sender: "bot", text: `Hey there! ${reviewQuestions[0]}` },
  ]);
  const [answers, setAnswers] = useState<{ question: string; answer: string }[]>([]);
  const [reviewSummary, setReviewSummary] = useState(
    `The ${itemName} was delicious, and the whole bag tasted super fresh. I also loved the great flavor. It's a tasty and healthy snack.`
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleUserReply = (replyText: string, nextBotText: string) => {
    setAnswers((prev) => [
      ...prev,
      { question: reviewQuestions[step] || "Review question", answer: replyText },
    ]);
    setMessages((prev) => [...prev, { sender: "user", text: replyText }]);

    setTimeout(() => {
      setMessages((prev) => [...prev, { sender: "bot", text: nextBotText }]);
      setStep((prev) => prev + 1);
    }, 600);
  };

  const handleFinishChat = (replyText: string) => {
    const userAns1 =
      messages[1]?.text ||
      `The ${itemName} was delicious, and the whole bag tasted super fresh.`;
    const userAns2 = messages[3]?.text || "I also loved the great flavor.";
    const userAns3 = replyText;

    setAnswers((prev) => [
      ...prev,
      { question: reviewQuestions[2], answer: replyText },
    ]);
    setReviewSummary(`${userAns1} ${userAns2} ${userAns3}`);
    setMessages((prev) => [...prev, { sender: "user", text: replyText }]);
    setTimeout(() => {
      setStep(3);
    }, 600);
  };

  const getPlaceholderText = () => {
    if (step === 0) return "It was delicious, and the whole bag was super fresh!";
    if (step === 1) return "Mostly the great flavor.";
    if (step === 2) return "Yes, it's a tasty and healthy snack.";
    return "Write your review...";
  };

  const handleSendCustomReply = () => {
    const textToSend = inputText.trim() || getPlaceholderText();
    setInputText("");

    if (step === 0) {
      handleUserReply(textToSend, `Glad to hear it. ${reviewQuestions[1]}`);
    } else if (step === 1) {
      handleUserReply(textToSend, reviewQuestions[2]);
    } else if (step === 2) {
      handleFinishChat(textToSend);
    }
  };

  const handleSubmitReview = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit({
        content: reviewSummary,
        rating: 5,
        answers: answers.length
          ? answers
          : [{ question: "Review", answer: reviewSummary }],
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not submit review."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="w-full max-w-[500px] h-[80vh] min-h-[550px] bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden relative border border-gray-100">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 relative flex-shrink-0">
              <Image src="/homepage/cardImage.png" alt="Product" fill className="object-cover" />
            </div>
            <span className="font-semibold text-gray-800 truncate max-w-[280px]">
              Review: {itemName}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="flex-grow p-4 overflow-y-auto flex flex-col gap-3 bg-gray-50/50">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"} w-full`}
            >
              <div
                className={`max-w-[75%] rounded-[14px] p-3 text-sm font-medium shadow-sm ${
                  m.sender === "user"
                    ? "bg-[#3E3EDF] text-white"
                    : "bg-[#F0F8FB] text-[#1F1D1D]"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {step >= 3 && (
            <div className="w-full flex flex-col gap-3 mt-2 animate-fade-in">
              <div className="bg-white border border-gray-200 rounded-[12px] p-4 shadow-sm relative">
                {isEditing ? (
                  <textarea
                    value={reviewSummary}
                    onChange={(e) => setReviewSummary(e.target.value)}
                    className="w-full h-24 p-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-[#3E3EDF]"
                  />
                ) : (
                  <p className="text-sm font-normal leading-relaxed text-gray-800">
                    {reviewSummary}
                  </p>
                )}
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-[#3E3EDF] text-sm hover:underline cursor-pointer font-medium"
                  >
                    {isEditing ? "Done" : "Edit"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-1">
                <span className="text-sm font-medium text-gray-700">First-time purchase?</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsFirstTime(true)}
                    className={`flex-1 py-2 text-sm border rounded-lg transition-all cursor-pointer font-medium ${
                      isFirstTime === true
                        ? "bg-blue-50 border-[#3E3EDF] text-[#3E3EDF]"
                        : "bg-white border-gray-300 text-gray-700"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setIsFirstTime(false)}
                    className={`flex-1 py-2 text-sm border rounded-lg transition-all cursor-pointer font-medium ${
                      isFirstTime === false
                        ? "bg-blue-50 border-[#3E3EDF] text-[#3E3EDF]"
                        : "bg-white border-gray-300 text-gray-700"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-white">
          {step < 3 ? (
            <div className="w-full relative flex items-center bg-[#FFFFFF] border border-[#E0E0E0] rounded-[12px] shadow-[0px_4px_4px_rgba(0,0,0,0.04)] px-[17px] py-[8px]">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendCustomReply();
                }}
                placeholder={getPlaceholderText()}
                className="flex-grow bg-transparent border-none text-[#1F1D1D] text-[14px] leading-[17px] focus:outline-none placeholder-gray-400 py-1"
              />
              <button
                onClick={handleSendCustomReply}
                className="w-8 h-8 rounded-full bg-[#3E3EDF] hover:bg-[#3232c7] text-white flex items-center justify-center cursor-pointer transition-all ml-2 flex-shrink-0"
              >
                <svg className="w-4 h-4 transform rotate-90" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSubmitReview}
                disabled={isSubmitting}
                className="w-full py-3 bg-[#3E3EDF] text-white text-sm font-semibold rounded-lg hover:bg-[#3232c7] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md"
              >
                {isSubmitting ? "Submitting..." : "Submit Review & Get $1.00"}
              </button>
              {submitError && (
                <p className="text-center text-xs font-medium text-[#E65353]">
                  {submitError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
