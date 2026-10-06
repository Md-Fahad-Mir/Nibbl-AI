"use client";

import React, { useState } from "react";

interface SettingsPasswordFlowProps {
  onBackToMenu: () => void;
  defaultEmail?: string;
  onChangePassword?: (currentPassword: string, newPassword: string) => Promise<void>;
  onForgotPassword?: (email: string) => Promise<void>;
  onResetPassword?: (email: string, code: string, newPassword: string) => Promise<void>;
}

type PasswordFlowStep =
  | "change-password"
  | "forgot-password"
  | "verify-otp"
  | "reset-password";

export const SettingsPasswordFlow: React.FC<SettingsPasswordFlowProps> = ({
  onBackToMenu,
  defaultEmail = "",
  onChangePassword,
  onForgotPassword,
  onResetPassword,
}) => {
  const [step, setStep] = useState<PasswordFlowStep>("change-password");

  // Change Password state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Forgot Password / OTP state
  const [email, setEmail] = useState(defaultEmail);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  // Reset Password state
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetNew, setShowResetNew] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`settings-otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (newPassword !== confirmPassword) {
      setErrorMsg("New password and confirmation do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onChangePassword?.(oldPassword, newPassword);
      setSuccessMsg("Password updated successfully!");
      window.setTimeout(() => {
        setSuccessMsg("");
        onBackToMenu();
      }, 2500);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Password update failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    try {
      setIsSubmitting(true);
      await onForgotPassword?.(email);
      setStep("verify-otp");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Could not send reset code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (otp.join("").length !== 6) {
      setErrorMsg("Enter the 6 digit code sent to your email.");
      return;
    }

    setStep("reset-password");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (resetNewPassword !== resetConfirmPassword) {
      setErrorMsg("New password and confirmation do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onResetPassword?.(email, otp.join(""), resetNewPassword);
      setSuccessMsg("Password reset successfully!");
      window.setTimeout(() => {
        setSuccessMsg("");
        setStep("change-password");
      }, 2500);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Password reset failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[500px] flex flex-col gap-6 font-inter">
      {/* Success Banner */}
      {successMsg && (
        <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-[8px] font-medium text-[14px] flex items-center justify-between shadow-xs">
          <span>{successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg("")}
            className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="w-full rounded-[8px] border border-red-100 bg-red-50 px-4 py-3 text-[14px] font-medium text-red-600 shadow-xs">
          {errorMsg}
        </div>
      )}

      {/* STEP 1: CHANGE PASSWORD */}
      {step === "change-password" && (
        <div className="w-full flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToMenu}
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

          <form
            onSubmit={handlePasswordUpdate}
            className="w-full flex flex-col gap-5"
          >
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
            <div className="w-full text-left pt-1">
              <button
                type="button"
                onClick={() => setStep("forgot-password")}
                className="text-[14px] text-[#3E3EDF] font-normal hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {/* Update Password CTA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[48px] bg-[#3E3EDF] hover:bg-[#3232C7] disabled:opacity-60 text-white font-medium text-[16px] rounded-[8px] transition-colors cursor-pointer shadow-md mt-4"
            >
              {isSubmitting ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
      )}

      {/* STEP 2: FORGOT PASSWORD */}
      {step === "forgot-password" && (
        <div className="w-full flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep("change-password")}
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
              Forgot Password
            </h2>
          </div>

          <p className="text-[14px] text-[#575757] font-normal">
            Please enter your email address to reset your password
          </p>

          <form onSubmit={handleSendOtp} className="w-full flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-[#1F1D1D]">
                Enter Your Email
              </label>
              <div className="w-full h-[56px] px-4 bg-[#FEFEFE] border border-[#3E3EDF] rounded-[8px] flex items-center gap-3 focus-within:border-[#3E3EDF]">
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
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input
                  type="email"
                  placeholder="Enter your Email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-[15px] text-[#1F1D1D] placeholder:text-gray-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[48px] bg-[#3E3EDF] hover:bg-[#3232C7] disabled:opacity-60 text-white font-medium text-[16px] rounded-[8px] transition-colors cursor-pointer shadow-md mt-2"
            >
              {isSubmitting ? "Sending..." : "Send OTP"}
            </button>
          </form>
        </div>
      )}

      {/* STEP 3: VERIFY OTP */}
      {step === "verify-otp" && (
        <div className="w-full flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep("forgot-password")}
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
              Verify Email
            </h2>
          </div>

          <p className="text-[14px] text-[#575757] font-normal">
            Please enter the 6 digit code sent to your email
          </p>

          <form onSubmit={handleVerifyOtp} className="w-full flex flex-col gap-6">
            <div className="flex items-center justify-center gap-4 py-2">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  id={`settings-otp-${idx}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  className="w-14 h-14 text-center font-semibold text-[20px] bg-[#FEFEFE] border border-[#3E3EDF] rounded-[8px] outline-none focus:ring-2 focus:ring-[#3E3EDF]"
                />
              ))}
            </div>

            <button
              type="submit"
              className="w-full h-[48px] bg-[#3E3EDF] hover:bg-[#3232C7] text-white font-medium text-[16px] rounded-[8px] transition-colors cursor-pointer shadow-md"
            >
              Verify
            </button>
          </form>
        </div>
      )}

      {/* STEP 4: RESET PASSWORD */}
      {step === "reset-password" && (
        <div className="w-full flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep("verify-otp")}
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
              Reset Password
            </h2>
          </div>

          <p className="text-[14px] text-[#575757] font-normal">
            Set your new password
          </p>

          <form
            onSubmit={handleResetPassword}
            className="w-full flex flex-col gap-5"
          >
            {/* New Password */}
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-[#1F1D1D]">
                Set new password
              </label>
              <div className="w-full h-[56px] px-4 bg-[#FEFEFE] border border-[#3E3EDF] rounded-[8px] flex items-center justify-between gap-3 focus-within:border-[#3E3EDF]">
                <input
                  type={showResetNew ? "text" : "password"}
                  placeholder="Set new password"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-[15px] text-[#1F1D1D] placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowResetNew(!showResetNew)}
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
                    {showResetNew ? (
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

            {/* Confirm Password */}
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-[#1F1D1D]">
                Re-enter new password
              </label>
              <div className="w-full h-[56px] px-4 bg-[#FEFEFE] border border-[#3E3EDF] rounded-[8px] flex items-center justify-between gap-3 focus-within:border-[#3E3EDF]">
                <input
                  type={showResetConfirm ? "text" : "password"}
                  placeholder="Re-enter new password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-[15px] text-[#1F1D1D] placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(!showResetConfirm)}
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
                    {showResetConfirm ? (
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[48px] bg-[#3E3EDF] hover:bg-[#3232C7] disabled:opacity-60 text-white font-medium text-[16px] rounded-[8px] transition-colors cursor-pointer shadow-md mt-2"
            >
              {isSubmitting ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
