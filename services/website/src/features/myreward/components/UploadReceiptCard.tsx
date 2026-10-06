"use client";

import { useRef, useState } from "react";
import Image from "next/image";

interface UploadReceiptCardProps {
  onUploadStart: () => void;
  onUploadSuccess: (file: File) => void | Promise<void>;
}

export default function UploadReceiptCard({ onUploadStart, onUploadSuccess }: UploadReceiptCardProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Trigger loading flow
    setIsUploading(true);
    onUploadStart();

    void Promise.resolve(onUploadSuccess(file)).finally(() => {
      setIsUploading(false);
      e.target.value = "";
    });
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  const triggerTakePhotoClick = () => {
    cameraInputRef.current?.click();
  };

  return (
    <section className="w-full max-w-[667px] bg-[#FEFEFE] shadow-[0px_4px_4px_rgba(0,0,0,0.2)] rounded-[12px] p-4 flex flex-col items-center gap-[23px] border border-gray-100">
      <span className="text-[24px] font-semibold leading-[29px] text-[#2D2D2D] text-center w-full">
        Upload New Receipt
      </span>

      {/* Hidden file input */}
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Action buttons (Frame 2147229197) */}
      <div className="flex flex-row justify-center items-center gap-[19px] w-full max-w-[643px]">
        {/* Take Photo button (Frame 2147228990) */}
        <button
          onClick={triggerTakePhotoClick}
          disabled={isUploading}
          className="flex-1 max-w-[179px] h-[44px] bg-gradient-to-r from-[#3E3EDF] to-[#3E3EDF] hover:opacity-95 active:scale-[0.98] disabled:opacity-50 text-white rounded-[12px] flex items-center justify-center gap-2 transition-all cursor-pointer focus:outline-none"
        >
          <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center relative">
            <Image
              src="/myreward/arcticons_gallery.svg"
              alt="gallery-icon"
              width={20}
              height={20}
              className="object-contain filter invert brightness-200"
            />
          </span>
          <span className="text-[14px] sm:text-[16px] font-medium">
            Take Photo
          </span>
        </button>

        {/* Upload photo button (Frame 2147229171) */}
        <button
          onClick={triggerUploadClick}
          disabled={isUploading}
          className="flex-1 max-w-[203px] h-[45px] bg-[#FEFEFE] border border-[#3E3EDF] hover:bg-blue-50/50 active:scale-[0.98] disabled:opacity-50 text-[#3E3EDF] rounded-[12px] flex items-center justify-center gap-2 transition-all cursor-pointer focus:outline-none shadow-[0px_4px_4px_rgba(0,0,0,0.08)]"
        >
          <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center relative">
            <Image
              src="/myreward/Vector.png"
              alt="upload-icon"
              width={16}
              height={16}
              className="object-contain"
            />
          </span>
          <span className="text-[14px] sm:text-[16px] font-medium text-[#3E3EDF]">
            Upload photo
          </span>
        </button>
      </div>

      {isUploading && (
        <div className="w-full flex items-center justify-center gap-2 mt-1">
          <div className="w-4 h-4 border-2 border-[#3E3EDF] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[#3E3EDF] font-medium">Uploading receipt...</span>
        </div>
      )}
    </section>
  );
}
