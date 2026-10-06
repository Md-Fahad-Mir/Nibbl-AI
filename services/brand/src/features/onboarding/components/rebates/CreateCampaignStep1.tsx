/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";

interface CreateCampaignStep1Props {
  onCancel: () => void;
  onContinue: (data: {
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    imageSrc: string;
  }) => void;
  initialData: {
    name: string;
    description?: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    imageSrc?: string;
  };
  mode?: "create" | "edit";
}

export default function CreateCampaignStep1({
  onCancel,
  onContinue,
  initialData,
  mode = "create",
}: CreateCampaignStep1Props) {
  const [name, setName] = useState(initialData.name);
  const [description, setDescription] = useState(initialData.description || "");
  const [startDate, setStartDate] = useState(initialData.startDate || "");
  const [endDate, setEndDate] = useState(initialData.endDate || "");
  const [isActive, setIsActive] = useState(initialData.isActive);
  const [imageSrc, setImageSrc] = useState(initialData.imageSrc || "/Rebate/bannerPreviewImage.svg");
  const [imageError, setImageError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectCreativeFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image must be 5MB or smaller.");
      return;
    }
    if (imageSrc.startsWith("blob:")) URL.revokeObjectURL(imageSrc);
    setImageSrc(URL.createObjectURL(file));
    setImageError("");
  };

  const handleContinue = () => {
    if (!name) return;
    onContinue({ name, description, startDate, endDate, isActive, imageSrc });
  };

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left">
      {/* Stepper indicators header */}
      <div className="relative grid grid-cols-4 items-start gap-2 w-full max-w-[920px] mx-auto font-manrope font-semibold border-b border-slate-100 py-3">
        <div className="absolute left-[12.5%] right-[12.5%] top-[31px] h-[2px] bg-[#EAEDFF]"></div>
        {[
          { step: "1", title: "Basic Info", active: true },
          { step: "2", title: "Products", active: false },
          { step: "3", title: "Budget & Offers", active: false },
          { step: "4", title: "Review & publish", active: false },
        ].map((s) => (
          <div key={s.step} className="relative z-10 flex flex-col items-center gap-2 min-w-0">
            <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
              s.active ? "bg-[#001BD2] text-white shadow-[0_0_0_8px_#DFE0FF]" : "bg-[#DAE2FD] text-[#454656]"
            }`}>{s.step}</span>
            <span className={s.active ? "text-[#001BD2] text-xs text-center" : "text-slate-400 text-xs text-center"}>{s.title}</span>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">
          {mode === "edit" ? "Edit Campaign" : "Campaign Fundamentals"}
        </h2>
        <p className="text-xs text-[#64748B] font-medium leading-normal mt-2">
          {mode === "edit"
            ? "Update this campaign's identity, schedule, and active state."
            : "Define the core identity and scheduling for your new rebate campaign. This data will be used to track performance and anchor your creative assets."}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start w-full font-manrope">
        {/* Left Column Forms */}
        <div className="flex-grow flex flex-col gap-6 w-full lg:max-w-[62%]">
          <div className="bg-white border border-slate-100 rounded-[20px] p-6 shadow-sm flex flex-col gap-6 w-full">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-[#131B2E]">Identity & Scope</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#454656] uppercase tracking-wider">ACTIVE STATUS</span>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-150 focus:outline-none cursor-pointer ${
                    isActive ? "bg-[#001BD2]" : "bg-slate-200"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-150 ${
                    isActive ? "translate-x-5" : "translate-x-0"
                  }`}></div>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#454656] uppercase tracking-wider">CAMPAIGN NAME</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer Cashback Rewards 2024"
                className="w-full h-11 bg-white border border-slate-200/80 rounded-xl px-4 text-sm focus:outline-none focus:border-[#001BD2] text-slate-800 placeholder-[#757688] shadow-inner"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#454656] uppercase tracking-wider">CAMPAIGN DESCRIPTION</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the campaign offer, audience, or internal notes..."
                className="w-full bg-white border border-slate-200/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#001BD2] text-slate-800 placeholder-[#757688] shadow-inner resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#454656] uppercase tracking-wider">START DATE</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-11 bg-white border border-slate-200/80 rounded-xl px-4 text-sm focus:outline-none focus:border-[#001BD2] text-slate-800 shadow-inner"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#454656] uppercase tracking-wider">END DATE (OPTIONAL)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-11 bg-white border border-slate-200/80 rounded-xl px-4 text-sm focus:outline-none focus:border-[#001BD2] text-slate-800 shadow-inner"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#F2F3FF]/60 border border-[#F2F3FF] rounded-2xl p-4 flex gap-3 items-start">
            <div className="w-5 h-5 rounded-full bg-[#E2E7FF] text-[#001BD2] text-xs font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">i</div>
            <p className="text-xs text-[#454656] leading-[1.62] font-medium">
              You can edit your campaign anytime after launch. Ensure your campaign duration aligns with the quarterly budget allocations previously approved in the <span className="text-[#001BD2] font-bold underline">Financial Settings</span>. Dates can be modified later until the campaign is published.
            </p>
          </div>
        </div>

        {/* Right Column Creative Upload */}
        <div className="w-full lg:max-w-[38%] bg-white border border-slate-100 rounded-[20px] p-6 shadow-sm flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-[#131B2E]">Campaign Creative</h3>
            <span className="bg-red-50 text-[#BA1A1A] text-[9px] font-bold px-2 py-0.5 rounded">REQD</span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(event) => selectCreativeFile(event.target.files?.[0])}
          />
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              selectCreativeFile(event.dataTransfer.files?.[0]);
            }}
            className="border-2 border-dashed border-[#C5C5D9]/40 rounded-xl p-5 flex flex-col items-center justify-center gap-4 bg-slate-50/50 hover:bg-slate-50 transition-colors w-full"
          >
            <div className="w-full h-[100px] bg-white rounded-lg flex items-center justify-center border border-slate-100 overflow-hidden relative flex-shrink-0">
              <img
                src={imageSrc}
                alt="Banner Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-center font-manrope">
              <p className="text-xs font-bold text-[#131B2E]">Drag & Drop Visuals</p>
              <p className="text-[10px] text-[#64748B] mt-1 leading-normal">Recommended size: 1200x400px. PNG, JPG or WebP formats accepted.</p>
            </div>
            {imageError && <p className="text-[10px] font-bold text-[#BA1A1A]">{imageError}</p>}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-[#E2E7FF] text-[#001BD2] text-xs font-bold rounded-lg hover:bg-blue-100 active:scale-[0.98] transition-all cursor-pointer"
            >
              Browse Files
            </button>
          </div>
        </div>
      </div>

      {/* Stepper Footer actions */}
      <div className="flex justify-between items-center w-full border-t border-slate-100 pt-6 mt-4">
        <button onClick={onCancel} className="text-sm font-bold text-[#757688] hover:text-slate-600 cursor-pointer">
          ← Cancel & Exit
        </button>
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-6 h-[46px] bg-[#E2E7FF] text-[#001BD2] font-bold text-sm rounded-xl hover:bg-blue-100 transition-colors cursor-pointer">Save as Draft</button>
          <button
            onClick={handleContinue}
            disabled={!name}
            className={`px-6 h-[46px] bg-[#001BD2] hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all cursor-pointer ${
              !name ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            Continue to Products →
          </button>
        </div>
      </div>
    </div>
  );
}
