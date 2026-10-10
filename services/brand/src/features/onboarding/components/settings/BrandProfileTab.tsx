/* eslint-disable @next/next/no-img-element */
"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Save, ShieldCheck, X } from "lucide-react";
import { backendAssetUrl } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

const normalizeWebsite = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

// US zones first, then every other IANA zone the browser knows.
const US_ZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix",
  "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu",
];
const TIME_ZONES = [
  ...US_ZONES,
  ...(typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"])
    .filter((zone) => !US_ZONES.includes(zone)),
];

export default function BrandProfileTab() {
  const brand = useBrandApiStore((state) => state.brand);
  const updateBrandProfile = useBrandApiStore((state) => state.updateBrandProfile);
  const [draft, setDraft] = useState<{
    brandName?: string;
    description?: string;
    website?: string;
    email?: string;
    timezone?: string;
  }>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoObjectUrl, setLogoObjectUrl] = useState("");
  const logoObjectUrlRef = useRef("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const brandName = draft.brandName ?? String(brand?.legal_name ?? brand?.name ?? "");
  const description = draft.description ?? String(brand?.description ?? "");
  const website = draft.website ?? String(brand?.website ?? "");
  const email = draft.email ?? String(brand?.contact_email ?? "");
  const timezone = draft.timezone ?? String(brand?.timezone ?? "America/New_York");
  const currentLogoUrl = backendAssetUrl(brand?.logo_url ?? brand?.logo, "");
  const logoPreview = logoObjectUrl || currentLogoUrl;
  const brandStatus =
    typeof brand?.status === "string" && brand.status.trim()
      ? brand.status
      : "";

  useEffect(() => {
    return () => {
      if (logoObjectUrlRef.current) URL.revokeObjectURL(logoObjectUrlRef.current);
    };
  }, []);

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (logoObjectUrlRef.current) URL.revokeObjectURL(logoObjectUrlRef.current);

    const objectUrl = file ? URL.createObjectURL(file) : "";
    logoObjectUrlRef.current = objectUrl;
    setLogoObjectUrl(objectUrl);
    setLogoFile(file);
    setMessage(file ? `${file.name} selected.` : "");
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage("");

      const formData = new FormData();
      formData.append("legal_name", brandName.trim());
      formData.append("description", description.trim());
      formData.append("website", normalizeWebsite(website));
      formData.append("contact_email", email.trim());
      formData.append("timezone", timezone);
      if (logoFile) formData.append("logo", logoFile);

      await updateBrandProfile(formData);
      setLogoFile(null);
      if (logoObjectUrlRef.current) URL.revokeObjectURL(logoObjectUrlRef.current);
      logoObjectUrlRef.current = "";
      setLogoObjectUrl("");
      if (logoInputRef.current) logoInputRef.current.value = "";
      setMessage("Brand profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save brand profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-8 w-full text-left font-manrope">
      <div className="flex flex-col gap-8">
        <div className="bg-white border border-[#C5C5D9]/10 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-[20px] overflow-hidden">
          <div className="bg-[#F2F3FF] px-8 py-5 border-b border-[#C5C5D9]/5">
            <h3 className="font-jakarta font-bold text-sm tracking-[1.4px] text-[#454656] uppercase">
              Brand Identity
            </h3>
          </div>
          <div className="p-8 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#454656] uppercase tracking-wider pl-1">
                  Brand Name
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, brandName: event.target.value }))
                  }
                  className="bg-[#F2F3FF] border-none rounded-2xl px-5 py-3.5 text-sm font-semibold text-[#131B2E] outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#454656] uppercase tracking-wider pl-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, description: event.target.value }))
                  }
                  className="bg-[#F2F3FF] border-none rounded-2xl px-5 py-3.5 text-sm font-semibold text-[#131B2E] outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#454656] uppercase tracking-wider pl-1">
                Website URL
              </label>
              <input
                type="url"
                value={website}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, website: event.target.value }))
                }
                placeholder="https://kitkat.com"
                className="bg-[#F2F3FF] border-none rounded-2xl px-5 py-3.5 text-sm font-semibold text-[#131B2E] outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#454656] uppercase tracking-wider pl-1">
                Support Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, email: event.target.value }))
                }
                className="bg-[#F2F3FF] border-none rounded-2xl px-5 py-3.5 text-sm font-semibold text-[#131B2E] outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#454656] uppercase tracking-wider pl-1">
                Default Time Zone
              </label>
              <select
                value={timezone}
                onChange={(event) => setDraft((prev) => ({ ...prev, timezone: event.target.value }))}
                className="bg-[#F2F3FF] border-none rounded-2xl px-5 py-3.5 text-sm font-semibold text-[#131B2E] outline-none"
              >
                {TIME_ZONES.map((zone) => (
                  <option key={zone} value={zone}>{zone.replace(/_/g, " ")}</option>
                ))}
              </select>
              <span className="text-[11px] text-[#454656]/70 pl-1">
                Controls the dates shown across your dashboard.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3">
              {message && (
                <span className="text-xs font-bold text-[#001BD2]">{message}</span>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-[#001BD2] hover:bg-blue-700 text-white text-sm font-bold px-6 py-2.5 rounded-full disabled:opacity-60 flex items-center gap-2 border-none cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#C5C5D9]/10 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-[20px] overflow-hidden h-fit">
        <div className="bg-[#F2F3FF] px-8 py-5 border-b border-[#C5C5D9]/5">
          <h3 className="font-jakarta font-bold text-sm tracking-[1.4px] text-[#454656] uppercase">
            Brand Logo
          </h3>
        </div>
        <div className="p-8 flex flex-col gap-5">
          <div className="relative w-[144px] h-[144px] bg-[#001BD2]/5 border-2 border-dashed border-[#C5C5D9] rounded-[20px] flex items-center justify-center flex-shrink-0">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt={`${brandName || "Brand"} logo`}
                className="h-full w-full rounded-[18px] object-contain p-3"
              />
            ) : (
              <div className="w-12 h-12 bg-[#001BD2] text-white font-extrabold text-xl rounded-2xl flex items-center justify-center">
                {brandName.charAt(0) || "B"}
              </div>
            )}
          </div>

          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="bg-[#E2E7FF] hover:bg-[#D0D7FF] px-4 py-2 rounded-full text-xs font-bold text-[#001BD2] border-none cursor-pointer flex items-center gap-2"
            >
              <ImagePlus className="w-4 h-4" />
              Choose Image
            </button>
            {logoFile && (
              <button
                type="button"
                onClick={() => {
                  if (logoObjectUrlRef.current) URL.revokeObjectURL(logoObjectUrlRef.current);
                  logoObjectUrlRef.current = "";
                  setLogoObjectUrl("");
                  setLogoFile(null);
                  if (logoInputRef.current) logoInputRef.current.value = "";
                }}
                className="bg-transparent hover:bg-red-50 px-4 py-2 rounded-full text-xs font-bold text-[#BA1A1A] border-none cursor-pointer flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>

          {brandStatus && (
            <div className="border-t border-[#C5C5D9]/10 pt-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[#137333]">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Status
                </span>
              </div>
              <span className="bg-[#E8F8F0] text-[#137333] px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                {brandStatus}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
