/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

interface ProductItem {
  id: string;
  name: string;
  category: string;
  imageSrc: string;
}

interface CreateCampaignStep2Props {
  onBack: () => void;
  onContinue: (selectedProductIds: string[]) => void;
  initialSelectedIds: string[];
  products: ProductItem[];
}

export default function CreateCampaignStep2({ onBack, onContinue, initialSelectedIds, products }: CreateCampaignStep2Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialSelectedIds.slice(0, 1)
  );
  const [searchQuery, setSearchQuery] = useState("");

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => (current[0] === id ? [] : [id]));
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8 w-full animate-slide-up text-left">
      {/* Stepper indicators header */}
      <div className="relative grid grid-cols-4 items-start gap-2 w-full max-w-[920px] mx-auto font-manrope font-semibold border-b border-slate-100 py-3">
        <div className="absolute left-[12.5%] right-[12.5%] top-[31px] h-[2px] bg-[#EAEDFF]"></div>
        <div className="absolute left-[12.5%] w-[25%] top-[31px] h-[2px] bg-[#001BD2]"></div>
        {[
          { step: "1", title: "Basic Info", done: true },
          { step: "2", title: "Products", active: true },
          { step: "3", title: "Budget & Offers", active: false },
          { step: "4", title: "Review & publish", active: false },
        ].map((s) => (
          <div key={s.step} className="relative z-10 flex flex-col items-center gap-2 min-w-0">
            <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
              s.active ? "bg-[#001BD2] text-white shadow-[0_0_0_8px_#DFE0FF]" : s.done ? "bg-[#DAE2FD] text-[#001BD2]" : "bg-[#DAE2FD] text-[#454656]"
            }`}>{s.done ? "✓" : s.step}</span>
            <span className={s.active ? "text-[#001BD2] text-xs text-center" : "text-slate-400 text-xs text-center"}>{s.title}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-end w-full">
        <div>
          <h2 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">Select Product</h2>
          <p className="text-xs text-[#64748B] font-medium leading-normal mt-2">
            Products are used for receipt matching and campaign eligibility
          </p>
        </div>

        {/* Search */}
        <div className="w-[320px] relative">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[42px] bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-xs focus:outline-none focus:border-[#001BD2] text-slate-800 placeholder-[#757688]"
          />
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <img src="/reviews/searchIcon.svg" alt="Search" className="w-[18px] h-[18px] object-contain" />
          </div>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full font-manrope">
        {filteredProducts.map((p) => {
          const isSelected = selectedIds.includes(p.id);
          return (
            <div
              key={p.id}
              onClick={() => toggleSelect(p.id)}
              className={`bg-white border rounded-[20px] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer relative flex flex-col justify-between h-[230px] group ${
                isSelected ? "border-[#001BD2] ring-2 ring-[#001BD2]/10" : "border-slate-100"
              }`}
            >
              {/* Selection indicator */}
              <div className={`absolute top-4 right-4 w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                isSelected ? "bg-[#001BD2] border-[#001BD2] text-white" : "border-slate-300 bg-white"
              }`}>
                {isSelected && <span className="text-[10px] font-bold">✓</span>}
              </div>

              {/* Product Visual */}
              <div className="w-full h-[110px] bg-slate-50 rounded-xl overflow-hidden mb-3 flex items-center justify-center">
                <img src={p.imageSrc} alt={p.name} className="max-h-full max-w-full object-contain" />
              </div>

              <div className="flex flex-col text-left">
                <h4 className="text-xs font-bold text-[#131B2E] tracking-tight">{p.name}</h4>
                <p className="text-[10px] text-[#64748B] font-medium mt-1">{p.category}</p>
              </div>
            </div>
          );
        })}
        {filteredProducts.length === 0 && (
          <div className="col-span-full bg-white border border-slate-100 rounded-[20px] p-10 text-center text-sm font-semibold text-slate-400">
            No products found in the backend product library.
          </div>
        )}
      </div>

      {/* Stepper Footer Actions */}
      <div className="flex justify-between items-center w-full border-t border-slate-100 pt-6 mt-4">
        <button onClick={onBack} className="text-sm font-bold text-[#757688] hover:text-slate-600 cursor-pointer">
          ← Back to Details
        </button>
        <div className="flex items-center gap-6">
          <span className="text-xs font-bold text-[#001BD2]">
            {selectedIds.length === 1 ? "1 Product selected for campaign" : "No product selected for campaign"}
          </span>
          <button
            onClick={() => onContinue(selectedIds.slice(0, 1))}
            disabled={selectedIds.length === 0}
            className={`px-6 h-[46px] bg-[#001BD2] hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all cursor-pointer ${
              selectedIds.length === 0 ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            Continue to Budget & Offers →
          </button>
        </div>
      </div>
    </div>
  );
}
