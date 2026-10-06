/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import StrengthBar, { getPasswordStrength } from "./StrengthBar";
import CategoryGrid, { categories } from "./CategoryGrid";
import { useBrandApiStore } from "@/stores/useBrandApiStore";

const officeLocations = [
  "North America (Global HQ)",
  "Europe (EU HQ)",
  "Asia-Pacific (APAC HQ)",
  "Latin America (LATAM HQ)",
];

export default function RegisterCard() {
  const router = useRouter();
  const { registerAndApply, error, status } = useBrandApiStore();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [brandName, setBrandName] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [officeLocation, setOfficeLocation] = useState(officeLocations[0]);
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [formError, setFormError] = useState("");
  const passwordStrength = getPasswordStrength(password);
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const isPasswordStrongEnough = passwordStrength.score >= 3;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!isPasswordStrongEnough) {
      setFormError("Use a stronger password before creating your account.");
      return;
    }
    if (!accepted) {
      setFormError("Accept the terms and privacy policy to continue.");
      return;
    }
    try {
      await registerAndApply({
        fullName,
        email,
        password,
        brandName,
        website,
        phone,
        officeLocation,
        category: selectedCategory?.name || categoryId,
      });
      router.push(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch {
      // Store keeps the displayable error.
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF8FF] flex items-center justify-center p-4 py-16 md:py-24 font-jakarta">
      {/* Registration Card Wrapper */}
      <div className="w-full max-w-[576px] bg-white rounded-3xl shadow-xl p-6 md:p-10 flex flex-col gap-8 border border-slate-100/50 animate-slide-up">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="relative w-[194px] h-[72px]">
            <Image
              src="/Auth/LogoImage.svg"
              alt="NibblAI Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Header Title */}
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#131B2E] tracking-tight">
            Get started with NibblAI
          </h2>
          <p className="text-sm font-medium text-[#454656] leading-relaxed">
            Create your enterprise account and access the dashboard.
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Row 1: Full Name & Business Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#454656]">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 text-sm focus:outline-none focus:border-[#001BD2] focus:ring-1 focus:ring-[#001BD2] font-manrope placeholder-slate-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#454656]">Business Phone</label>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 text-sm focus:outline-none focus:border-[#001BD2] focus:ring-1 focus:ring-[#001BD2] font-manrope placeholder-slate-400"
              />
            </div>
          </div>

          {/* Row 2: Company/Brand Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-extrabold text-[#454656]">Company/Brand name</label>
            <input
              type="text"
              placeholder="e.g. Acme Corp"
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
              required
              className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 text-sm focus:outline-none focus:border-[#001BD2] focus:ring-1 focus:ring-[#001BD2] font-manrope placeholder-slate-400"
            />
          </div>

          {/* Row 3: Website URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-extrabold text-[#454656]">Website URL</label>
            <input
              type="text"
              placeholder="www.yourbrand.com"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 text-sm focus:outline-none focus:border-[#001BD2] focus:ring-1 focus:ring-[#001BD2] font-manrope placeholder-slate-400"
            />
          </div>

          {/* Row 4: Work Email Address */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#454656]">Work Email Address</label>
            <input
              type="email"
              placeholder="john@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 text-sm focus:outline-none focus:border-[#001BD2] focus:ring-1 focus:ring-[#001BD2] font-manrope placeholder-slate-400"
            />
          </div>

          {/* Row 5: Office Location Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#454656]">Office Location</label>
            <select
              value={officeLocation}
              onChange={(event) => setOfficeLocation(event.target.value)}
              className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 text-sm focus:outline-none focus:border-[#001BD2] focus:ring-1 focus:ring-[#001BD2] font-manrope text-slate-800"
            >
              {officeLocations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          {/* Row 6: Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#454656]">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                aria-describedby="password-strength"
                required
                className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 pr-12 text-sm focus:outline-none focus:border-[#001BD2] focus:ring-1 focus:ring-[#001BD2] font-manrope placeholder-slate-400"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#757688] transition-colors hover:text-[#001BD2] focus:outline-none focus:text-[#001BD2]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Password Strength */}
          <div id="password-strength">
            <StrengthBar password={password} />
          </div>

          {/* Business Category Grid */}
          <CategoryGrid selected={categoryId} onSelect={setCategoryId} />

          {/* Acceptance Checkbox */}
          <div className="flex items-center gap-3 py-1 font-manrope">
            <input
              type="checkbox"
              id="terms"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="w-5 h-5 rounded-md border-slate-300 text-[#001BD2] focus:ring-[#001BD2] cursor-pointer"
            />
            <label htmlFor="terms" className="text-[13px] font-medium text-[#454656] cursor-pointer">
              I accept the{" "}
              <span className="text-[#001BD2] hover:underline">Terms and Conditions</span> and{" "}
              <span className="text-[#001BD2] hover:underline">Privacy Policy</span>
            </label>
          </div>

          {/* Create Account Button */}
          {formError && <p className="text-sm font-semibold text-red-600">{formError}</p>}
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={!accepted || !isPasswordStrongEnough || status === "loading"}
            className="flex items-center justify-center w-full h-[60px] rounded-full text-white font-bold text-lg bg-gradient-to-r from-[#001BD2] to-[#2D3FEA] hover:opacity-95 transition-all shadow-lg shadow-blue-600/25 active:scale-[0.98] disabled:opacity-60"
          >
            {status === "loading" ? "Creating..." : "Create Account"}
          </button>

          {/* OR Divider */}
          <div className="flex items-center justify-center gap-4 py-1">
            <div className="h-[1px] bg-slate-200 flex-1"></div>
            <span className="text-xs font-extrabold tracking-widest text-[#757688] uppercase">
              Or
            </span>
            <div className="h-[1px] bg-slate-200 flex-1"></div>
          </div>

          {/* Google Sign Up Button */}
          <button
            type="button"
            disabled
            className="flex items-center justify-center gap-3 w-full h-12 rounded-full border border-slate-200 bg-slate-50 text-[#757688] font-bold text-sm transition-all duration-200 cursor-not-allowed opacity-70"
          >
            <img
              src="/Auth/3rdPageIcons/googleIcon.svg"
              alt="Google icon"
              className="w-5 h-5 object-contain"
            />
            <span>Google sign-up unavailable</span>
          </button>
        </form>

        {/* Footer Login Link */}
        <div className="text-center font-manrope text-sm font-medium text-[#454656]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#001BD2] font-extrabold hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
