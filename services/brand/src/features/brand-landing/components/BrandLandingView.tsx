import Image from "next/image";
import Link from "next/link";

// Master onboarding ②–④: public brand homepage, How it works / Reviews /
// Controls, and Plans (before authentication).
const WHY = [
  ["👥", "Acquire new-to-brand customers", "Match relevant shoppers with the right products."],
  ["🔄", "Reconnect with existing customers", "Use opted-in customer data across your owned channels."],
  ["⭐", "Build loyalty and repeat purchase", "Run controlled offers and campaign-specific cooldowns."],
  ["⚙️", "Generate reviews consistently", "Review campaigns can run independently from rebate claims."],
];
const STEPS = [
  ["📣", "Launch a controlled campaign", "Set products, audience, geography, retailers and pacing."],
  ["🎯", "Reach the right shoppers", "Find new-to-brand customers and reconnect with known customers."],
  ["🧾", "Verify real purchases", "Receipt and line-item checks confirm product experience."],
  ["⭐", "Build lasting relationships", "Encourage repeat purchase and generate verified reviews consistently."],
];
const CONTROLS = [
  ["⚙️", "Control your pace", "Adjust campaign goals for the next 25-hour cycle."],
  ["📊", "Control repeat participation", "Campaign-specific cooldowns prevent repeat redemption."],
  ["🛡️", "Protect your campaigns", "Pause campaigns and suspend suspicious shoppers."],
];
const PLANS = [
  { name: "Starter", price: 39, slug: "starter", blurb: "Test customer acquisition and review campaigns",
    fit: "Recommended under $1K monthly Nibbl spend", features: ["1 active rebate campaign", "20% fee on shopper rewards", "$5 per completed review", "Limited customer identity"] },
  { name: "Pro", price: 199, slug: "pro", blurb: "Grow customer contacts, repeat engagement and reviews", recommended: true,
    fit: "Recommended for $1K–$5K monthly Nibbl spend", features: ["3 active rebate campaigns", "15% fee on shopper rewards", "$4 per completed review", "Full opted-in customer contacts and CSV export"] },
  { name: "Scale", price: 999, slug: "scale", blurb: "Run Nibbl as an always-on acquisition, loyalty and review channel",
    fit: "Recommended for $5K+ monthly Nibbl spend", features: ["10 active rebate campaigns", "10% fee on shopper rewards", "$3 per completed review", "Future integrations and API", "Monthly account-manager insights"] },
];

const Card = ({ icon, title, text }: { icon: string; title: string; text: string }) => (
  <div className="bg-white border border-[#EAEDFF] rounded-2xl p-5 flex flex-col gap-2 text-center">
    <span className="text-2xl">{icon}</span>
    <span className="font-extrabold text-[#131B2E]">{title}</span>
    <span className="text-sm text-[#64748B]">{text}</span>
  </div>
);

export default function BrandLandingView() {
  return (
    <div className="w-full min-h-screen bg-[#FAF8FF] text-[#131B2E] font-jakarta">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-[#EAEDFF]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/brand-landing"><Image src="/Auth/LogoImage.svg" alt="Nibbl" width={110} height={40} priority /></Link>
          <nav className="hidden md:flex gap-6 text-sm font-semibold text-[#454656]">
            <a href="#how">How It Works</a><a href="#reviews">Reviews</a><a href="#controls">Controls</a><a href="#plans">Plans</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-bold text-[#001BD2]">Sign In</Link>
            <Link href="/register" className="h-10 px-5 rounded-xl bg-[#001BD2] text-white text-sm font-bold flex items-center">Get Started</Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-8 py-12 flex flex-col gap-20">
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="flex flex-col gap-5">
            <span className="text-xs font-extrabold tracking-widest text-[#001BD2] uppercase">Nibbl for Brands</span>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              Turn shoppers into new customers—and customers into <span className="text-[#001BD2]">loyal advocates.</span>
            </h1>
            <p className="text-[#454656] text-lg">
              Drive trial, reconnect with opted-in customers, encourage repeat purchase, and generate verified-purchase
              reviews consistently—all at a pace you control.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="h-12 px-6 rounded-xl bg-[#001BD2] text-white font-bold flex items-center">Get Started →</Link>
              <a href="#how" className="h-12 px-6 rounded-xl border border-[#001BD2]/40 text-[#001BD2] font-bold flex items-center">See How It Works</a>
            </div>
            <div className="flex flex-wrap gap-5 text-sm text-[#454656]">
              <span>✓ Verified purchases</span><span>📊 Flexible daily pacing</span><span>🛡️ Built-in fraud controls</span>
            </div>
          </div>
          <div className="relative w-full h-[320px]">
            <Image src="/Auth/brandImage.svg" alt="" fill className="object-contain" />
          </div>
        </section>

        <section className="flex flex-col gap-6 text-center">
          <span className="text-xs font-extrabold tracking-widest text-[#001BD2] uppercase">Why Nibbl</span>
          <h2 className="text-3xl font-extrabold">Grow the entire customer relationship.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WHY.map(([icon, title, text]) => <Card key={title} icon={icon} title={title} text={text} />)}
          </div>
        </section>

        <section id="how" className="flex flex-col gap-6 text-center scroll-mt-20">
          <h2 className="text-3xl font-extrabold">Acquire. Reconnect. Build loyalty. Keep reviews coming.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map(([icon, title, text], i) => <Card key={title} icon={`${i + 1}. ${icon}`} title={title} text={text} />)}
          </div>
        </section>

        <section id="reviews" className="bg-white border border-[#EAEDFF] rounded-[24px] p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center scroll-mt-20">
          <div className="relative w-full h-[220px]">
            <Image src="/Auth/reviewImage.svg" alt="" fill className="object-contain" />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-extrabold">New verified reviews, on a cadence you control.</h2>
            <p className="text-[#454656]">
              Set the number of review opportunities distributed each cycle. Review campaigns run independently from rebate
              claims, so feedback can continue even when trial campaigns change.
            </p>
            <ul className="text-sm text-[#454656] flex flex-col gap-1">
              <li>🛒 Social proof for your website</li>
              <li>📈 Fresh feedback for retailer conversations</li>
              <li>🔍 Useful product content for search and AI discovery</li>
            </ul>
            <p className="text-xs text-[#94A3B8]">Opted-in customer contacts can support email, MMS and other owned-channel follow-up on eligible plans.</p>
          </div>
        </section>

        <section id="controls" className="flex flex-col gap-6 text-center scroll-mt-20">
          <h2 className="text-3xl font-extrabold">Keep full control of your program.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CONTROLS.map(([icon, title, text]) => <Card key={title} icon={icon} title={title} text={text} />)}
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#454656]">
            <span>✓ Verified receipts</span><span>🧾 Duplicate receipt prevention</span>
            <span>👤 Identity and payout controls</span><span>🛡️ Monitored withdrawals</span>
          </div>
        </section>

        <section id="plans" className="flex flex-col gap-6 text-center scroll-mt-20">
          <h2 className="text-3xl font-extrabold">Start small. Scale when you&apos;re ready.</h2>
          <p className="text-[#454656] -mt-3">Flexible plans with lower unit costs as your Nibbl program grows.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
            {PLANS.map((plan) => (
              <div key={plan.slug} className={`bg-white rounded-[24px] p-6 flex flex-col gap-3 border ${
                plan.recommended ? "border-[#001BD2] shadow-lg" : "border-[#EAEDFF]"
              }`}>
                {plan.recommended && <span className="self-start text-[11px] font-bold text-white bg-[#001BD2] rounded-full px-3 py-1">Recommended</span>}
                <h3 className="text-xl font-extrabold">{plan.name}</h3>
                <div><span className="text-4xl font-extrabold">${plan.price}</span><span className="text-[#64748B]">/month</span></div>
                <p className="text-sm text-[#454656]">{plan.blurb}</p>
                <p className="text-xs text-[#94A3B8]">{plan.fit}</p>
                <ul className="text-sm text-[#131B2E] flex flex-col gap-1.5 flex-1">
                  {plan.features.map((f) => <li key={f}>✓ {f}</li>)}
                </ul>
                <Link href={`/register?plan=${plan.slug}`}
                  className={`h-11 rounded-xl font-bold text-sm flex items-center justify-center ${
                    plan.recommended ? "bg-[#001BD2] text-white" : "border border-[#001BD2]/40 text-[#001BD2]"
                  }`}>
                  Choose {plan.name}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#64748B]">
            All plans include unlimited products, receipt verification, fraud controls, review campaigns and review export.
            Plan changes begin at the next 30-day renewal.
          </p>
          <div className="bg-white border border-[#EAEDFF] rounded-2xl p-4 text-left text-sm">
            <b>Have a promotional code? Apply it during checkout.</b>{" "}
            <span className="text-[#454656]">Promotional credits may cover eligible subscription charges and Nibbl fees, never shopper rewards.</span>
          </div>
        </section>

        <section className="bg-white border border-[#EAEDFF] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <span className="font-extrabold">Questions?</span>
          <span className="text-sm text-[#454656] flex flex-wrap gap-4">
            <span>Pricing FAQ</span><span>Review campaigns FAQ</span><span>Account &amp; billing FAQ</span><span>General FAQ</span>
          </span>
          <Link href="/register" className="h-11 px-5 rounded-xl bg-[#001BD2] text-white font-bold text-sm flex items-center">Get Started →</Link>
        </section>
      </main>
    </div>
  );
}
