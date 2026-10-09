import { useMemo, useState } from "react";
import { Search, Star, X } from "lucide-react";
import { RetailerOption } from "@/stores/useBrandApiStore";

const MAX_FEATURED = 3;

interface RetailerPickerProps {
  directory: RetailerOption[];
  selected: string[];
  featured: string[];
  onChange: (selected: string[], featured: string[]) => void;
  /** Adds a retailer missing from the directory; resolves to the new (or matching) one. */
  onAdd: (name: string) => Promise<RetailerOption>;
}

/** Master ⑤ Retailer Availability: pick every retailer where the products
 *  are sold (never all by default), star up to three as Featured. */
export default function RetailerPicker({ directory, selected, featured, onChange, onAdd }: RetailerPickerProps) {
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const byId = useMemo(() => new Map(directory.map((r) => [r.id, r])), [directory]);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return directory.filter((r) => !selected.includes(r.id) && (!q || r.name.toLowerCase().includes(q))).slice(0, 12);
  }, [directory, search, selected]);

  const toggle = (id: string) =>
    selected.includes(id)
      ? onChange(selected.filter((s) => s !== id), featured.filter((f) => f !== id))
      : onChange([...selected, id], featured);

  const toggleFeatured = (id: string) => {
    setError("");
    if (featured.includes(id)) return onChange(selected, featured.filter((f) => f !== id));
    if (featured.length >= MAX_FEATURED) return setError("Choose up to three featured retailers.");
    onChange(selected, [...featured, id]);
  };

  const add = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    setError("");
    try {
      const retailer = await onAdd(newName.trim());
      if (!selected.includes(retailer.id)) onChange([...selected, retailer.id], featured);
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the retailer.");
    } finally {
      setAdding(false);
    }
  };

  const input =
    "h-10 px-3 rounded-xl border border-[#E0E3F5] bg-white text-sm text-[#131B2E] outline-none focus:border-[#001BD2]";

  return (
    <div className="flex flex-col gap-3">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((id) => {
            const isFeatured = featured.includes(id);
            return (
              <span
                key={id}
                className={`flex items-center gap-1.5 rounded-full border px-3 h-8 text-xs font-semibold ${
                  isFeatured ? "border-[#001BD2] bg-[#F2F3FF] text-[#001BD2]" : "border-[#E0E3F5] text-[#131B2E]"
                }`}
              >
                <button type="button" onClick={() => toggleFeatured(id)} title={isFeatured ? "Unfeature" : "Feature"} className="cursor-pointer">
                  <Star className={`w-3.5 h-3.5 ${isFeatured ? "fill-[#001BD2]" : ""}`} />
                </button>
                {byId.get(id)?.name ?? "Retailer"}
                {byId.get(id) && !byId.get(id)?.is_verified && <span className="text-[10px] text-[#94A3B8]">(pending)</span>}
                <button type="button" onClick={() => toggle(id)} title="Remove" className="cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-[#94A3B8]">No retailers selected yet.</p>
      )}
      <p className="text-xs text-[#64748B]">
        Select every retailer where the eligible products are sold. Star up to three as Featured Retailers — they appear
        in the offer summary.
      </p>

      <div className="relative">
        <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3" />
        <input className={`${input} w-full pl-9`} placeholder="Search Nibbl's retailer directory" value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>
      {matches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {matches.map((r) => (
            <button key={r.id} type="button" onClick={() => toggle(r.id)}
              className="h-8 px-3 rounded-full bg-[#FAF8FF] border border-[#EAEDFF] text-xs font-semibold text-[#454656] hover:border-[#001BD2] cursor-pointer">
              + {r.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input className={`${input} flex-1`} placeholder="Missing a retailer? Add it" value={newName}
          onChange={(e) => setNewName(e.target.value)} />
        <button type="button" onClick={add} disabled={adding || !newName.trim()}
          className="h-10 px-4 rounded-full border border-[#001BD2] text-[#001BD2] text-sm font-bold disabled:opacity-40 cursor-pointer">
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="text-xs font-semibold text-[#BA1A1A]">{error}</p>}
    </div>
  );
}
