"use client";

import { useState } from "react";

interface InviteFriendsModalProps {
  onClose: () => void;
  onSend: (name: string, contact: string) => void;
}

export default function InviteFriendsModal({ onClose, onSend }: InviteFriendsModalProps) {
  const [fullName, setFullName] = useState("");
  const [contact, setContact] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !contact.trim()) return;
    onSend(fullName, contact);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in select-none">
      {/* Frame 2147229224 */}
      <div className="w-full max-w-[400px] bg-[#FEFEFE] shadow-[0px_4px_6.5px_rgba(0,0,0,0.25)] rounded-[12px] p-6 relative flex flex-col items-center border border-gray-100 animate-scale-up">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-xl font-bold cursor-pointer focus:outline-none"
        >
          &times;
        </button>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {/* Header block (Frame 2147229223) */}
          <div className="flex flex-col items-center gap-[4px] text-center w-full">
            <span className="text-[20px] font-semibold leading-[24px] text-[#2D2D2D] tracking-tight">
              Invite Friends, Earn $5
            </span>
            <span className="text-[14px] font-normal leading-[17px] text-[#575757]">
              Get $5 when your friend uploads their first receipt and completes a review
            </span>
          </div>

          {/* Input 1: Friends full name (Frame 427319643) */}
          <div className="w-full h-[50px] bg-[#FEFEFE] border border-[#959595] rounded-[8px] flex items-center px-4">
            <input
              type="text"
              placeholder="Friends full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full bg-transparent border-none text-[#1F1D1D] placeholder-[#707070] text-[14px] font-normal leading-[17px] focus:outline-none"
            />
          </div>

          {/* Input 2: Email or phone (Frame 427319643) */}
          <div className="w-full h-[50px] bg-[#FEFEFE] border border-[#959595] rounded-[8px] flex items-center px-4 gap-2">
            {/* Envelope Icon */}
            <span className="w-6 h-6 flex-shrink-0 text-[#707070] flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="E-mail address or phone number"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
              className="w-full bg-transparent border-none text-[#1F1D1D] placeholder-[#707070] text-[14px] font-normal leading-[17px] focus:outline-none"
            />
          </div>

          {/* CTA Large Button */}
          <button
            type="submit"
            className="w-full h-[54px] bg-[#3E3EDF] hover:bg-[#3232c7] active:scale-[0.99] transition-all text-white text-[18px] font-medium rounded-[8px] flex items-center justify-center cursor-pointer focus:outline-none shadow-[0px_4px_4px_rgba(0,0,0,0.12),_inset_0px_4px_4px_rgba(255,255,255,0.12)]"
          >
            Send Invite
          </button>
        </form>
      </div>
    </div>
  );
}
