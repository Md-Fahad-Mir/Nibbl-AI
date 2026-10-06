"use client";

import { useState } from "react";
import Image from "next/image";

interface FooterProps {
  onTabChange?: (tab: "offer" | "wallet" | "scan" | "profile" | "brand" | "notification", extra?: string) => void;
}

export default function Footer({ onTabChange }: FooterProps) {
  const [email, setEmail] = useState("");
  const [subscribeMessage, setSubscribeMessage] = useState("");

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setSubscribeMessage("Newsletter signup is not connected to the backend yet.");
    setEmail("");
  };

  return (
    <footer className="w-full bg-[#F0F0F0] pt-[25px] pb-6 px-6 sm:px-12 lg:px-[190px] font-sans flex flex-col items-center">
      {/* Outer Layout wrapper (Frame 2147229118 / 2147229117) */}
      <div className="w-full max-w-[1061px] flex flex-col gap-[39px] z-0">
        
        {/* Three Columns Container (Frame 2147229114) */}
        <div className="w-full flex flex-col lg:flex-row justify-between items-start gap-10 lg:gap-[100px]">
          
          {/* Column 1: Brand & Newsletter Signup (Frame 2147229032) */}
          <div className="w-full max-w-[319px] flex flex-col gap-[27px]">
            {/* Logo Image */}
            <Image
              src="/logo/smallLogo.svg"
              alt="nibblAI Logo"
              width={150}
              height={57}
              priority
              className="h-[57px] w-[150px] object-contain"
            />
            
            {/* Description Text (Frame 63) */}
            <div className="w-full flex items-center py-2.5">
              <p className="text-[#434343] text-base leading-[19px] font-normal w-[298px]">
                Sing Up News Latter To get Update Conformation News Incite or Promotion
              </p>
            </div>

            {/* Newsletter Input Card (Frame 2147229031 / Frame 65) */}
            <form
              onSubmit={handleSubscribe}
              className="w-[265px] h-[43px] bg-[#FFFFFF] shadow-[0_4px_6.6px_rgba(0,0,0,0.25)] rounded-[10px] flex items-center justify-between pl-3 pr-1.5 relative"
            >
              <input
                type="email"
                required
                placeholder="Enter Your Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent border-none text-[#676464] placeholder:text-[#676464] text-sm font-normal focus:outline-none w-[130px] h-full"
              />
              
              {/* Submit Button (Frame 64) */}
              <button
                type="submit"
                className="w-[78px] h-[31px] bg-gradient-to-r from-[#3E3EDF] to-[#3E3EDF] hover:opacity-90 text-white font-medium text-[15px] rounded-[5px] flex items-center justify-center cursor-pointer transition-opacity"
              >
                Sign Up
              </button>
            </form>
            {subscribeMessage && (
              <p className="text-[12px] leading-[16px] text-[#575757]">
                {subscribeMessage}
              </p>
            )}
          </div>

          {/* Column 2: Help & Support Column (Frame 2147229112) */}
          <div className="w-full max-w-[200px] flex flex-col gap-[18px]">
            <h3 className="text-[#434343] text-[26px] font-medium leading-[31px]">
              Help &amp; support
            </h3>
            
            <ul className="flex flex-col gap-[18px] text-base font-normal">
              <li>
                <a
                  href={onTabChange ? undefined : "mailto:support@nibble.ai?subject=Support%20Request"}
                  onClick={(e) => {
                    if (onTabChange) {
                      e.preventDefault();
                      onTabChange("profile", "help");
                    }
                  }}
                  className="text-[#575757] hover:text-black leading-[19px] text-left cursor-pointer transition-colors focus:outline-none"
                >
                  Contact us
                </a>
              </li>
              <li>
                <a
                  href={onTabChange ? undefined : "#"}
                  onClick={(e) => {
                    if (onTabChange) {
                      e.preventDefault();
                      onTabChange("profile", "privacy");
                    }
                  }}
                  className="text-[#575757] hover:text-black leading-[19px] transition-colors cursor-pointer"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href={onTabChange ? undefined : "#"}
                  onClick={(e) => {
                    if (onTabChange) {
                      e.preventDefault();
                      onTabChange("profile", "terms");
                    }
                  }}
                  className="text-[#575757] hover:text-black leading-[19px] transition-colors cursor-pointer"
                >
                  Terms &amp; Conditions
                </a>
              </li>
              <li>
                <a
                  href={onTabChange ? undefined : "#"}
                  onClick={(e) => {
                    if (onTabChange) {
                      e.preventDefault();
                      onTabChange("profile", "faq");
                    }
                  }}
                  className="text-[#575757] hover:text-black leading-[19px] transition-colors cursor-pointer"
                >
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Address & Contact (Frame 2147229113) */}
          <div className="w-full max-w-[237px] flex flex-col gap-[20px]">
            <h3 className="text-[#434343] text-[26px] font-medium leading-[31px]">
              Address
            </h3>
            
            {/* Contact Rows Container (Frame 126) */}
            <ul className="flex flex-col gap-[18px] text-base font-normal">
              {/* Location Row */}
              <li className="flex gap-[6px] items-start">
                <span className="w-[20.76px] flex-shrink-0 flex justify-center pt-0.5">
                  <Image
                    src="/homepage/location.svg"
                    alt="Location"
                    width={18}
                    height={22}
                    className="w-[18px] h-[22px] object-contain"
                  />
                </span>
                <span className="text-[#434343] leading-[19px] w-[210px]">
                  New York City , USA
                </span>
              </li>
              
              {/* Phone Row */}
              <li className="flex gap-[6px] items-start">
                <span className="w-[20.76px] flex-shrink-0 flex justify-center pt-0.5">
                  <Image
                    src="/homepage/mobile.svg"
                    alt="Mobile"
                    width={16}
                    height={16}
                    className="w-4 h-4 object-contain"
                  />
                </span>
                <a
                  href="tel:+254585222001445"
                  className="text-[#434343] hover:text-black leading-[19px] w-[210px] transition-colors"
                >
                  +254585222001445
                </a>
              </li>
              
              {/* Email Row */}
              <li className="flex gap-[6px] items-start">
                <span className="w-[20.76px] flex-shrink-0 flex justify-center pt-0.5">
                  <Image
                    src="/homepage/email.svg"
                    alt="Email"
                    width={18}
                    height={17}
                    className="w-[18px] h-[17px] object-contain"
                  />
                </span>
                <a
                  href="mailto:support@nibble.ai"
                  className="text-[#434343] hover:text-black leading-[19px] w-[210px] break-all transition-colors"
                >
                  support@nibble.ai
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Divider & Copyright Container (Frame 2147229116) */}
        <div className="w-full flex flex-col gap-6 mt-2">
          
          {/* Divider Line (Line 1) */}
          <div className="w-full border-t border-[#777777] border-2" />
          
          {/* Social and Copyright Row (Frame 2147229115) */}
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-5">
            
            {/* Copyright Info (Frame 66) */}
            <span className="text-[#2A2A2A] text-base leading-[19px] font-normal w-[197px] text-center sm:text-left order-2 sm:order-1">
              2025 Our Website All over
            </span>
            
            {/* Social media links (Frame 73) */}
            <div className="flex gap-9 items-center justify-center order-1 sm:order-2">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-[19.26px] h-[19.26px] relative hover:scale-110 transition-transform"
              >
                <Image src="/homepage/fbIcon.svg" alt="Facebook" fill className="object-contain" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-[20.83px] h-[20.83px] relative hover:scale-110 transition-transform"
              >
                <Image src="/homepage/lindln.svg" alt="LinkedIn" fill className="object-contain" />
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-[25px] h-[25px] relative hover:scale-110 transition-transform"
              >
                <Image src="/homepage/twitter.svg" alt="Twitter" fill className="object-contain" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-[20.83px] h-[20.83px] relative hover:scale-110 transition-transform"
              >
                <Image src="/homepage/instragram.svg" alt="Instagram" fill className="object-contain" />
              </a>
            </div>
            
          </div>
          
        </div>

      </div>
    </footer>
  );
}
