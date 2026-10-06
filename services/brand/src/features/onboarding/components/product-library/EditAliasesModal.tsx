import { useState } from "react";

interface Product {
  id: string;
  name: string;
  imageSrc: string;
  category: string;
  flavor: string;
  format: string;
  size: string;
  aliases: string[];
  activeCampaigns: number;
}

interface EditAliasesModalProps {
  product: Product;
  onClose: () => void;
  onSave: (aliases: string[]) => void | Promise<void>;
}

export default function EditAliasesModal({ product, onClose, onSave }: EditAliasesModalProps) {
  const [aliases, setAliases] = useState<string[]>(product.aliases);
  const [aliasInput, setAliasInput] = useState("");

  const handleAddAlias = (e: React.FormEvent) => {
    e.preventDefault();
    if (aliasInput.trim() && !aliases.includes(aliasInput.trim())) {
      setAliases([...aliases, aliasInput.trim()]);
      setAliasInput("");
    }
  };

  const handleRemoveAlias = (alias: string) => {
    setAliases(aliases.filter((a) => a !== alias));
  };

  const handleSave = async () => {
    await onSave(aliases);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-jakarta">
      {/* Modal Card wrapper */}
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-[540px] flex flex-col overflow-hidden animate-scale-in border border-slate-100/50">
        
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100">
          <div className="flex flex-col gap-1.5 text-left">
            <span className="text-[10px] font-extrabold text-[#001BD2] tracking-wider uppercase">
              • EDIT IDENTITY
            </span>
            <h2 className="text-xl font-bold text-[#131B2E] tracking-tight">
              {product.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Card Body */}
        <div className="p-8 flex flex-col gap-6 w-full text-left font-manrope">
          {/* Blue info callout card */}
          <div className="bg-[#F2F3FF]/60 border border-[#F2F3FF] rounded-2xl p-4 flex gap-3 items-start">
            <div className="w-5 h-5 rounded-full bg-[#E2E7FF] text-[#001BD2] text-xs font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">
              i
            </div>
            <p className="text-xs text-[#454656] leading-[1.62] font-medium">
              Aliases help our <span className="font-bold text-[#131B2E]">OCR engine</span> automatically match items from various retailer receipts (e.g., Target vs. Costco) to this specific product in your inventory.
            </p>
          </div>

          {/* Current Active Aliases section */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-[#454656] uppercase tracking-wider">
              CURRENT ACTIVE ALIASES
            </span>
            <div className="flex flex-wrap gap-2 py-2">
              {aliases.map((alias) => (
                <div
                  key={alias}
                  className="flex items-center gap-1.5 border border-[#001BD2]/30 text-[#001BD2] bg-[#E2E7FF]/15 px-3 py-1 rounded-full text-xs font-semibold"
                >
                  <span>{alias}</span>
                  <button
                    onClick={() => handleRemoveAlias(alias)}
                    className="text-[#BA1A1A] font-extrabold hover:scale-110 cursor-pointer ml-0.5"
                  >
                    ⊗
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add New Alias input row */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold text-[#454656] uppercase tracking-wider">
              ADD NEW ALIAS
            </span>
            <form onSubmit={handleAddAlias} className="flex gap-2">
              <input
                type="text"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                placeholder="Type name exactly as seen on receipts..."
                className="flex-grow h-11 bg-white border border-slate-200 rounded-xl px-4 text-xs font-medium focus:outline-none focus:border-[#001BD2] text-slate-800 placeholder-[#757688]"
              />
              <button
                type="submit"
                className="h-11 px-6 bg-[#001BD2] text-white text-xs font-bold rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all cursor-pointer"
              >
                ADD
              </button>
            </form>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end items-center gap-4 px-8 py-5 bg-slate-50/50 border-t border-slate-100">
          <button
            onClick={onClose}
            className="text-sm font-bold text-[#757688] hover:text-slate-600 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 h-11 bg-[#001BD2] hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors active:scale-[0.98] cursor-pointer flex items-center gap-2 shadow-md shadow-blue-500/10"
          >
            <span>Save Aliases</span>
            <span className="text-xs">✓</span>
          </button>
        </div>

      </div>
    </div>
  );
}
