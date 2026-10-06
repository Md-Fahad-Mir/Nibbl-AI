"use client";

interface InviteFriendsCardProps {
  onInviteClick: () => void;
}

export default function InviteFriendsCard({ onInviteClick }: InviteFriendsCardProps) {
  return (
    <section className="w-full max-w-[669px] bg-[#FEFEFE] shadow-[0px_4px_6.5px_rgba(0,0,0,0.25)] rounded-[12px] p-6 sm:py-[12px] sm:px-[18px] flex flex-col items-center gap-[14px] border border-gray-100">
      {/* Title & Subtitle Frame 2147229223 */}
      <div className="flex flex-col items-center gap-[4px] w-full text-center">
        <span className="text-[20px] font-medium leading-[24px] text-[#2D2D2D]">
          Invite Friends, Earn $5
        </span>
        <span className="text-[14px] sm:text-[16px] font-normal leading-[19px] text-[#575757] max-w-[300px] mx-auto mt-0.5">
          Get $5 when your friend uploads their first receipt and completes a review
        </span>
      </div>

      {/* Action Button (CTA Large) */}
      <button
        onClick={onInviteClick}
        className="w-full max-w-[609px] h-[54px] bg-gradient-to-t from-[#3E3EDF] to-[#3E3EDF] hover:opacity-95 active:scale-[0.99] transition-all text-white text-[18px] font-medium rounded-[8px] flex items-center justify-center cursor-pointer focus:outline-none shadow-[0px_4px_4px_rgba(0,0,0,0.12),_inset_0px_4px_4px_rgba(255,255,255,0.12)]"
      >
        Next
      </button>
    </section>
  );
}
