"use client";

import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Lightbulb,
  Monitor,
  Pencil,
  QrCode,
  Sparkles,
  Sticker,
  Tag,
  Tags,
} from "lucide-react";

/** Master: static Tag Generator — Coming Soon page. Example creative only —
 *  no generation, editing, downloading, campaign selection or QR codes yet. */

const Num = ({ n }: { n: number }) => (
  <span className="w-8 h-8 rounded-full bg-[#E53935] text-white text-sm font-extrabold flex items-center justify-center flex-shrink-0">
    {n}
  </span>
);

const Section = ({ n, title, sub, children, className = "" }: { n: number; title: string; sub: string; children: React.ReactNode; className?: string }) => (
  <section className={`bg-white border border-[#E6EAFB] rounded-[20px] p-4 flex flex-col gap-3 ${className}`}>
    <div className="flex items-start gap-2">
      <Num n={n} />
      <div>
        <h3 className="font-jakarta font-extrabold text-lg text-[#001BD2] leading-tight">{title}</h3>
        <p className="text-xs text-[#64748B]">{sub}</p>
      </div>
    </div>
    {children}
  </section>
);

const Caption = ({ Icon, title, sub }: { Icon: React.ElementType; title: string; sub: string }) => (
  <div className="flex items-center gap-2 pt-1">
    <Icon className="w-5 h-5 text-[#001BD2] flex-shrink-0" />
    <span className="leading-tight">
      <span className="block text-xs font-bold text-[#131B2E]">{title}</span>
      <span className="block text-[11px] text-[#64748B]">{sub}</span>
    </span>
  </div>
);

/** Simple drawn stand-ins for product photos. */
const Can = ({ color, label }: { color: string; label: string }) => (
  <div className={`w-10 h-16 rounded-md ${color} shadow-md flex items-end justify-center pb-1`}>
    <span className="text-[7px] font-extrabold text-white leading-none text-center">{label}</span>
  </div>
);
const Bag = ({ color, label }: { color: string; label: string }) => (
  <div className={`w-12 h-16 rounded-t-lg rounded-b-md ${color} shadow-md flex items-center justify-center px-1`}>
    <span className="text-[7px] font-extrabold text-white leading-tight text-center">{label}</span>
  </div>
);
const Qr = ({ size = "w-12 h-12" }: { size?: string }) => (
  <span className={`${size} bg-white rounded-md flex items-center justify-center border border-black/10`}>
    <QrCode className="w-4/5 h-4/5 text-[#131B2E]" strokeWidth={1.5} />
  </span>
);
const Tiny = ({ children, light = false }: { children: React.ReactNode; light?: boolean }) => (
  <span className={`block text-[8px] leading-tight ${light ? "text-white/80" : "text-[#454656]"}`}>{children}</span>
);

export default function TagGeneratorView() {
  return (
    <div className="flex flex-col gap-5 w-full animate-slide-up text-left font-manrope">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight leading-none">Tag Generator</h2>
          <span className="text-xs font-bold text-[#001BD2] bg-[#E2E7FF] rounded-full px-3 py-1">Coming Soon</span>
        </div>
        <p className="text-sm text-[#454656] font-medium mt-1">Turn your Nibbl campaign into ready-to-share marketing inspiration.</p>
      </div>

      {/* Intro banner */}
      <section className="relative overflow-hidden rounded-[20px] border border-[#E6EAFB] bg-gradient-to-r from-white to-[#EEF2FF] p-5 flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-2">
          <span className="w-12 h-20 rounded-xl bg-[#001BD2] flex items-center justify-center shadow-lg">
            <Camera className="w-5 h-5 text-white" />
          </span>
          <span className="w-16 h-16 rounded-xl bg-white shadow-lg flex items-center justify-center">
            <QrCode className="w-10 h-10 text-[#131B2E]" strokeWidth={1.5} />
          </span>
        </div>
        <div className="flex-1 min-w-[220px]">
          <h3 className="font-jakarta font-extrabold text-xl text-[#001BD2]">Campaign Creative, Made Simple</h3>
          <p className="text-sm text-[#454656]">
            Explore examples of how brands can promote Nibbl campaigns across social, retail, packaging, email, and SMS.
          </p>
          <p className="text-xs text-[#94A3B8] mt-1">These are inspiration examples. Creative generation and editing tools are coming soon.</p>
        </div>
        <Sparkles className="w-10 h-10 text-[#3B5BFF] hidden sm:block" />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* 1 Meta Ads */}
        <Section n={1} title="Meta Ads" sub="Social ad concepts to drive awareness and participation.">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <div className="aspect-square rounded-xl bg-gradient-to-b from-[#FFF6D8] to-[#FFE3B3] p-2 flex flex-col items-center text-center gap-1">
                <span className="text-[9px] font-bold text-[#1F4E2C]">SUNNY GROVE</span>
                <span className="font-jakarta font-black text-[15px] leading-none text-[#1F4E2C]">TRY SUNNY GROVE FREE.</span>
                <Tiny>Buy one eligible item and get the verified purchase price back.</Tiny>
                <div className="flex gap-1 mt-auto">
                  <Can color="bg-orange-500" label="CITRUS" />
                  <Can color="bg-pink-500" label="BERRY" />
                  <Can color="bg-lime-500" label="LIME" />
                </div>
                <span className="mt-1 rounded-full bg-[#1F4E2C] text-white text-[9px] font-bold px-3 py-1 flex items-center gap-0.5">
                  View Deal <ChevronRight className="w-3 h-3" />
                </span>
              </div>
              <Caption Icon={Camera} title="Square Ad" sub="1080 × 1080" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="aspect-[9/16] max-h-[260px] rounded-xl bg-gradient-to-b from-[#3B5875] to-[#1E3347] p-2 flex flex-col items-center text-center gap-1">
                <span className="text-[9px] font-bold text-white">WILD TRAIL</span>
                <span className="font-jakarta font-black text-[18px] leading-none text-[#FFB547]">BOGO FREE.</span>
                <Tiny light>Buy two eligible packs. Get one reimbursed.</Tiny>
                <span className="rounded-full bg-[#F26B1D] text-white text-[9px] font-bold px-3 py-1 flex items-center gap-0.5">
                  Tap to Claim <ChevronRight className="w-3 h-3" />
                </span>
                <div className="flex gap-1 mt-auto">
                  <Bag color="bg-sky-700" label="TRAIL MIX" />
                  <Bag color="bg-amber-900" label="DARK CHOC" />
                  <Bag color="bg-red-700" label="CASHEW" />
                </div>
              </div>
              <Caption Icon={Camera} title="Story Ad" sub="1080 × 1920" />
            </div>
          </div>
        </Section>

        {/* 2 Retail Displays */}
        <Section n={2} title="Retail Displays" sub="In-store materials to capture shoppers at the point of purchase.">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <div className="rounded-xl bg-[#FFF8EC] border border-[#F1E2C6] p-3 flex flex-col items-center text-center gap-1.5 min-h-[230px]">
                <span className="font-jakarta font-extrabold text-sm text-[#2E6B30]">Meadow Crunch</span>
                <span className="font-jakarta font-black text-[17px] leading-none text-[#2E6B30]">BUY 1, GET 1 50% OFF.</span>
                <Tiny>Purchase two eligible items.</Tiny>
                <Qr />
                <span className="text-[11px] font-extrabold text-[#2E6B30]">Scan to Claim.</span>
                <Tiny>Tap to view current offer availability and terms.</Tiny>
              </div>
              <Caption Icon={Tags} title="Shelf Talker" sub="In-store shelf signage" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="rounded-xl bg-white border border-[#DCE3F2] p-3 flex flex-col items-center text-center gap-1.5 min-h-[230px]">
                <span className="font-jakarta font-extrabold text-sm text-[#1B3A6B]">HARBOR HARVEST</span>
                <span className="font-jakarta font-black text-[17px] leading-none text-[#1B3A6B]">BUY 3, GET $10 BACK.</span>
                <Tiny>On three eligible products.</Tiny>
                <Qr />
                <span className="text-[11px] font-extrabold text-[#1B3A6B]">Scan to View Deal.</span>
                <Tiny>Scan to view current offer availability and terms.</Tiny>
              </div>
              <Caption Icon={Monitor} title="Counter Sign" sub="Checkout or sampling areas" />
            </div>
          </div>
        </Section>

        {/* 3 On-Pack Ideas */}
        <Section n={3} title="On-Pack Ideas" sub="Product packaging that drives participation.">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <div className="rounded-xl bg-gradient-to-b from-[#C9B27A] to-[#8C6F3A] p-3 flex justify-center min-h-[230px]">
                <div className="w-[85%] rounded-xl bg-white/95 border-2 border-[#2B5DB4] p-2 flex flex-col items-center text-center gap-1">
                  <span className="text-[10px] font-extrabold text-[#2B5DB4]">Coast &amp; Bloom</span>
                  <span className="font-jakarta font-black text-[15px] leading-none text-[#1B3A6B]">BOGO FREE.</span>
                  <Tiny>Buy two eligible bottles.</Tiny>
                  <Qr size="w-10 h-10" />
                  <Tiny>Scan to view current offer availability and terms.</Tiny>
                </div>
              </div>
              <Caption Icon={Tag} title="Bottle Neck Tag" sub="Perfect for beverages" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="rounded-xl bg-[#A7C4A0] p-3 flex items-center justify-center min-h-[230px]">
                <div className="aspect-square w-full rounded-full bg-white flex flex-col items-center justify-center text-center gap-1 p-3">
                  <span className="text-[10px] font-extrabold text-[#2E6B30]">Bright Spoon</span>
                  <span className="font-jakarta font-black text-[15px] leading-none text-[#2E6B30]">TRY IT FREE.</span>
                  <Tiny>Verified purchase price back up to the campaign maximum.</Tiny>
                  <Qr size="w-9 h-9" />
                </div>
              </div>
              <Caption Icon={Sticker} title="Product Sticker" sub="Works on any package" />
            </div>
          </div>
        </Section>

        {/* 4 Email Campaign */}
        <Section n={4} title="Email Campaign" sub="Email inspiration to announce and drive your campaign.">
          <div className="rounded-xl border border-[#E6EAFB] overflow-hidden">
            <div className="bg-[#F8F9FC] px-3 py-2 text-[11px] text-[#454656] flex flex-col">
              <span className="flex items-center gap-1.5">
                <span className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" /><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="w-2 h-2 rounded-full bg-green-400" />
                </span>
                From: Luna Oats &lt;hello@lunaoats.com&gt;
              </span>
              <span className="pl-11">Subject: Buy 1, Get 1 50% Off Luna Oats</span>
            </div>
            <div className="bg-gradient-to-br from-[#FFF4E2] to-[#F6E2C2] p-4 flex flex-col gap-2">
              <span className="font-jakarta font-extrabold text-[#7A4A1E] tracking-wide">LUNA OATS</span>
              <span className="font-jakarta font-black text-xl leading-tight text-[#14306B]">BETTER MORNINGS, BETTER TOGETHER.</span>
              <span className="self-start bg-[#FFD54A] text-[#14306B] font-black text-sm px-2 py-0.5 rounded">BUY 1, GET 1 50% OFF.</span>
              <span className="text-xs text-[#454656]">Purchase two eligible Luna Oats products.</span>
              <span className="self-start rounded-full bg-[#14306B] text-white text-xs font-bold px-4 py-1.5 flex items-center gap-1">
                View Deal <ChevronRight className="w-3.5 h-3.5" />
              </span>
              <Tiny>Tap to view current offer availability and terms.</Tiny>
            </div>
          </div>
        </Section>

        {/* 5 MMS Message */}
        <Section n={5} title="MMS Message" sub="Multimedia message example to inform and activate shoppers.">
          <div className="mx-auto w-[220px] rounded-[30px] border-[6px] border-[#131B2E] bg-white overflow-hidden">
            <div className="flex justify-between px-3 pt-1 text-[10px] font-bold text-[#131B2E]"><span>9:41</span><span>●●●</span></div>
            <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-100">
              <ChevronLeft className="w-4 h-4 text-[#001BD2]" />
              <span className="flex-1 flex flex-col items-center">
                <span className="w-6 h-6 rounded-full bg-gray-200 text-[9px] font-bold flex items-center justify-center">WT</span>
                <span className="text-[9px] text-[#454656]">Wild Trail</span>
              </span>
            </div>
            <div className="p-2 flex flex-col gap-1">
              <div className="rounded-lg bg-gradient-to-b from-[#3B5875] to-[#1E3347] p-2 flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold text-white">WILD TRAIL</span>
                <div className="flex gap-1">
                  <Bag color="bg-sky-700" label="TRAIL MIX" />
                  <Bag color="bg-amber-900" label="CHOC" />
                </div>
                <span className="w-full text-center bg-[#FFD54A] text-[#131B2E] font-black text-[11px] rounded">BUY 3, GET $10 BACK.</span>
              </div>
              <div className="rounded-lg bg-[#F1F2F6] p-2 text-[10px] text-[#131B2E] leading-snug">
                Stock up on Wild Trail snack bites. Buy three eligible packs and get $10 back. View the deal:{" "}
                <span className="text-[#001BD2] underline">nibbl.co/wildtrail</span>
                <span className="block text-[9px] text-[#64748B] mt-1">Offer availability and terms shown on the deal page. Reply STOP to opt out.</span>
              </div>
            </div>
          </div>
        </Section>

        {/* 6 How It Will Work */}
        <Section n={6} title="How It Will Work" sub="From campaign to on-brand creative, in three simple steps.">
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-1 text-center">
            {([
              [FileText, "1. Choose a campaign", "Select an existing Nibbl campaign to get started."],
              null,
              [Lightbulb, "2. Generate a starting concept", "Get on-brand inspiration for multiple channels."],
              null,
              [QrCode, "3. Add your QR code and finish", "Customize and finalize your assets."],
            ] as ([React.ElementType, string, string] | null)[]).map((step, i) =>
              step ? (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="w-14 h-14 rounded-full bg-[#EEF2FF] flex items-center justify-center">
                    {(() => { const Icon = step[0]; return <Icon className="w-7 h-7 text-[#001BD2]" />; })()}
                  </span>
                  <span className="text-xs font-bold text-[#001BD2] leading-tight">{step[1]}</span>
                  <span className="text-[11px] text-[#64748B] leading-tight">{step[2]}</span>
                </div>
              ) : (
                <ChevronRight key={i} className="w-4 h-4 text-[#94A3B8] mt-5" />
              )
            )}
          </div>
          <div className="rounded-xl border border-[#F5D68B] bg-[#FFF8E6] p-3 flex gap-2">
            <AlertTriangle className="w-5 h-5 text-[#E53935] flex-shrink-0" />
            <span className="text-xs text-[#454656]">
              <b className="block text-[#E53935]">Offer copy changed</b>
              Your wording may no longer match this campaign&apos;s purchase or reward rules. Review before finalizing.
            </span>
          </div>
          <div className="rounded-xl bg-[#F2F4FF] p-3 flex gap-2 text-xs text-[#454656]">
            <Pencil className="w-4 h-4 text-[#001BD2] flex-shrink-0" />
            All wording is editable. Nibbl warns the brand when edited copy may conflict with the selected campaign.
          </div>
        </Section>
      </div>

      <p className="flex items-start gap-2 rounded-2xl border border-[#E6EAFB] bg-[#F7F8FF] px-4 py-3 text-xs text-[#454656]">
        <Info className="w-5 h-5 text-[#001BD2] flex-shrink-0" />
        <span>
          <b className="text-[#001BD2]">Every creative links to the live campaign page.</b> If the current claim cycle is
          exhausted, the shopper sees the current deal status there. Use &quot;Scan or tap to view current offer
          availability and terms&quot; instead of &quot;while supplies last.&quot;
        </span>
      </p>
    </div>
  );
}
