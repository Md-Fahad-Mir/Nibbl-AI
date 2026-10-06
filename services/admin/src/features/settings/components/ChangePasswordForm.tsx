"use client";

import React, { useState } from "react";

interface ChangePasswordFormProps {
  onBack: () => void;
  onForgotPassword?: () => void;
}

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({
  onBack,
  onForgotPassword,
}) => {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onBack();
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
          Change Password
        </h2>
      </div>

      <p className="text-[14px] text-[#575757] font-normal">
        Your password must be 8-10 character long.
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
        {/* Enter old password */}
        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-medium text-[#1F1D1D]">
            Enter old password
          </label>
          <div className="w-full h-[56px] px-4 bg-[#FEFEFE] border border-[#3E3EDF] rounded-[8px] flex items-center justify-between gap-3 focus-within:border-[#3E3EDF] transition-colors">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#575757"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>

            <input
              type={showOld ? "text" : "password"}
              placeholder="Enter old password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[15px] text-[#1F1D1D] placeholder:text-gray-400"
            />

            <button
              type="button"
              onClick={() => setShowOld(!showOld)}
              className="text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {showOld ? (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                ) : (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Set new password */}
        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-medium text-[#1F1D1D]">
            Set new password
          </label>
          <div className="w-full h-[56px] px-4 bg-[#FEFEFE] border border-[#3E3EDF] rounded-[8px] flex items-center justify-between gap-3 focus-within:border-[#3E3EDF] transition-colors">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#575757"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>

            <input
              type={showNew ? "text" : "password"}
              placeholder="Set new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[15px] text-[#1F1D1D] placeholder:text-gray-400"
            />

            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {showNew ? (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                ) : (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Re-enter new password */}
        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-medium text-[#1F1D1D]">
            Re-enter new password
          </label>
          <div className="w-full h-[56px] px-4 bg-[#FEFEFE] border border-[#3E3EDF] rounded-[8px] flex items-center justify-between gap-3 focus-within:border-[#3E3EDF] transition-colors">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#575757"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>

            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[15px] text-[#1F1D1D] placeholder:text-gray-400"
            />

            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {showConfirm ? (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                ) : (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Forgot password link */}
        {onForgotPassword && (
          <div className="w-full text-left pt-1">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-[14px] text-[#3E3EDF] font-normal hover:underline cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
        )}

        {/* Update Password CTA */}
        <button
          type="submit"
          className="w-full h-[48px] bg-[#3E3EDF] hover:bg-[#3232C7] text-white font-medium text-[16px] rounded-[8px] transition-colors cursor-pointer shadow-md mt-4"
        >
          Update password
        </button>
      </form>
    </div>
  );
};
