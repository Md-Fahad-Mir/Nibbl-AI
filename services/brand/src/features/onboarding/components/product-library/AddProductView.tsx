/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { ApiRecord, apiClient, backendApi } from "@/lib/api/backendApi";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { AliasRow } from "../../utils/mockData";
import DeleteProductModal from "./DeleteProductModal";

export type ProductFormValues = {
  name: string;
  description: string;
  brand: string;
  imageSrc: string;
  category: string;
  flavor: string;
  size: string;
  unit: string;
  packCount: number;
  sku: string;
  aliases: AliasRow[];
  imageFile?: File | null;
};

interface AddProductViewProps {
  onCancel: () => void;
  onSave: (product: ProductFormValues) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  initialProduct?: Partial<Omit<ProductFormValues, "aliases">> & { code?: string; aliasRecords?: AliasRow[] };
  mode?: "add" | "edit";
  workspaceBrandName?: string;
}

const UNITS = ["oz", "fl oz", "lb", "g", "kg", "ml", "L", "ct", "pk"];
const input = "w-full h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:border-[#001BD2] text-slate-800 placeholder-slate-400";
const label = "text-xs font-bold text-[#454656]";
const emptyAlias = (): AliasRow => ({ alias_text: "", retailer: "", item_code: "" });

/** Master Product Library: Add / Edit Product — one page with Product
 *  Identity and Receipt Matching. The Product ID is assigned on save. */
export default function AddProductView({
  onCancel,
  onSave,
  onDelete,
  initialProduct,
  mode = "add",
  workspaceBrandName = "",
}: AddProductViewProps) {
  const brandId = useBrandApiStore((s) => s.selectedBrandId) ?? "";
  const [form, setForm] = useState({
    name: initialProduct?.name ?? "",
    description: initialProduct?.description ?? "",
    category: initialProduct?.category ?? "",
    flavor: initialProduct?.flavor ?? "",
    size: initialProduct?.size ?? "",
    unit: initialProduct?.unit || "oz",
    packCount: String(initialProduct?.packCount ?? 1),
    sku: initialProduct?.sku ?? "",
  });
  const [aliases, setAliases] = useState<AliasRow[]>(
    initialProduct?.aliasRecords?.length ? initialProduct.aliasRecords.map((a) => ({ ...a })) : []
  );
  const [categories, setCategories] = useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);
  const [requesting, setRequesting] = useState<{ open: boolean; name: string; note: string; busy: boolean; msg: string }>(
    { open: false, name: "", note: "", busy: false, msg: "" }
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // The library shows a placeholder for products without a photo — not a real image.
  const savedImage = initialProduct?.imageSrc && !initialProduct.imageSrc.includes("/Auth/rebateImage") ? initialProduct.imageSrc : "";
  const previewSrc = imagePreview || savedImage;
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    if (!brandId) return;
    let live = true;
    apiClient
      .request<ApiRecord>(backendApi.brand.productCategories(brandId))
      .then((data) => {
        if (!live) return;
        const standard = (Array.isArray(data.categories) ? data.categories : []) as string[];
        const legacy = (Array.isArray(data.legacy) ? data.legacy : []) as string[];
        setCategories([...standard, ...legacy]);
        setPendingRequests(
          ((Array.isArray(data.requests) ? data.requests : []) as ApiRecord[])
            .filter((r) => r.status === "pending").map((r) => String(r.name))
        );
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [brandId]);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const pickImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Select a PNG, JPG or WebP image.");
    if (file.size > 5 * 1024 * 1024) return setError("Image must be 5MB or smaller.");
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  };

  const updateAlias = (index: number, key: keyof AliasRow, value: string) =>
    setAliases((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));

  const requestCategory = async () => {
    setRequesting((r) => ({ ...r, busy: true, msg: "" }));
    try {
      await apiClient.request(backendApi.brand.requestCategory(brandId), {
        body: { name: requesting.name, note: requesting.note },
      });
      setPendingRequests((p) => [...p, requesting.name.trim()]);
      setRequesting({ open: false, name: "", note: "", busy: false, msg: "Request sent — Nibbl will review it." });
    } catch (err) {
      setRequesting((r) => ({ ...r, busy: false, msg: err instanceof Error ? err.message : "Could not send the request." }));
    }
  };

  const save = async () => {
    if (!form.name.trim()) return setError("Enter the product name.");
    if (!form.category) return setError("Choose a category.");
    const pack = Number(form.packCount);
    if (!Number.isInteger(pack) || pack < 1) return setError("Pack count must be 1 or more.");
    setSaving(true);
    setError("");
    try {
      await onSave({
        name: form.name.trim(), description: form.description, brand: workspaceBrandName,
        imageSrc: initialProduct?.imageSrc ?? "", category: form.category, flavor: form.flavor.trim(),
        size: form.size.trim(), unit: form.size.trim() ? form.unit : "", packCount: pack, sku: form.sku.trim(),
        aliases: aliases.filter((a) => a.alias_text.trim()), imageFile,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the product.");
    } finally {
      setSaving(false);
    }
  };

  const options = Array.from(new Set([...categories, form.category].filter(Boolean)));

  return (
    <div className="flex flex-col gap-6 w-full animate-slide-up font-manrope">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 cursor-pointer">Product Library</button>
        <span className="text-slate-300">&gt;</span>
        <span className="text-[#001BD2]">{mode === "edit" ? "Edit Product" : "Add Product"}</span>
      </div>
      <h1 className="text-3xl font-extrabold font-jakarta text-[#131B2E] tracking-tight">
        {mode === "edit" ? "Edit Product" : "Add Product"}
      </h1>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 items-start">
        <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 shadow-sm flex flex-col gap-5">
          <h2 className="font-jakarta font-bold text-base text-[#131B2E]">Product Identity</h2>
          <div className="flex flex-col md:flex-row gap-5">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => pickImage(e.target.files?.[0])} />
              <button type="button" onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); pickImage(e.dataTransfer.files?.[0]); }}
                className="w-40 h-40 rounded-xl border-2 border-dashed border-[#C5C5D9]/60 bg-slate-50 flex flex-col items-center justify-center gap-1 overflow-hidden cursor-pointer">
                {previewSrc ? (
                  <img src={previewSrc} alt="" className="w-full h-full object-contain" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#454656]">Upload Image</span>
                    <span className="text-[10px] text-[#94A3B8] text-center px-2">PNG, JPG or WebP · Max 5MB</span>
                  </>
                )}
              </button>
              {previewSrc && (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="text-xs font-bold text-[#001BD2] cursor-pointer">Change Image</button>
              )}
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3">
              <label className="col-span-2 sm:col-span-1 flex flex-col gap-1"><span className={label}>Product Name</span>
                <input value={form.name} onChange={set("name")} placeholder="e.g. Acme Granola" className={input} /></label>
              <label className="col-span-2 sm:col-span-1 flex flex-col gap-1"><span className={label}>Brand</span>
                <input value={workspaceBrandName} readOnly className={`${input} bg-slate-50 text-slate-500`} /></label>
              <label className="col-span-2 sm:col-span-1 flex flex-col gap-1"><span className={label}>Flavor</span>
                <input value={form.flavor} onChange={set("flavor")} placeholder="e.g. Vanilla" className={input} /></label>
              <div className="col-span-2 grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1"><span className={label}>Size</span>
                  <input value={form.size} onChange={set("size")} inputMode="decimal" placeholder="12" className={input} /></label>
                <label className="flex flex-col gap-1"><span className={label}>Unit</span>
                  <select value={form.unit} onChange={set("unit")} className={input}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select></label>
                <label className="flex flex-col gap-1"><span className={label}>Pack Count</span>
                  <input value={form.packCount} onChange={set("packCount")} inputMode="numeric" className={input} /></label>
              </div>
            </div>
          </div>
          <label className="flex flex-col gap-1"><span className={label}>Product Description</span>
            <textarea value={form.description} onChange={set("description")} rows={3}
              className={`${input} h-auto py-2 resize-none`} />
            <span className="text-[11px] text-[#94A3B8]">Describe this product to help guide review questions.</span></label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <span className={label}>Category</span>
              <select value={form.category} onChange={set("category")} className={input}>
                <option value="">Choose a category</option>
                {options.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="button" onClick={() => setRequesting((r) => ({ ...r, open: !r.open, msg: "" }))}
                className="self-start text-xs font-bold text-[#001BD2] cursor-pointer">Request category</button>
            </div>
            <label className="flex flex-col gap-1"><span className={label}>Product ID</span>
              <input value={initialProduct?.code || ""} placeholder="Assigned on save" readOnly
                className={`${input} bg-slate-50 text-slate-500`} /></label>
            <label className="flex flex-col gap-1"><span className={label}>UPC / SKU <span className="font-normal text-[#94A3B8]">(Optional)</span></span>
              <input value={form.sku} onChange={set("sku")} placeholder="e.g. 012345678905" className={input} /></label>
          </div>
          {requesting.open && (
            <div className="border border-[#EAEDFF] rounded-xl p-4 flex flex-col gap-2 bg-[#FAF8FF]">
              <p className="text-xs text-[#454656]">Categories are standardized by Nibbl. Tell us what&apos;s missing and we&apos;ll review it.</p>
              <input value={requesting.name} onChange={(e) => setRequesting((r) => ({ ...r, name: e.target.value }))}
                placeholder="Category name" className={input} />
              <input value={requesting.note} onChange={(e) => setRequesting((r) => ({ ...r, note: e.target.value }))}
                placeholder="Note (optional)" className={input} />
              <button type="button" disabled={requesting.busy || !requesting.name.trim()} onClick={() => void requestCategory()}
                className="self-start h-9 px-4 rounded-full bg-[#001BD2] text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
                {requesting.busy ? "Sending…" : "Send request"}
              </button>
            </div>
          )}
          {requesting.msg && <p className="text-xs font-semibold text-[#001BD2]">{requesting.msg}</p>}
          {pendingRequests.length > 0 && (
            <p className="text-[11px] text-[#64748B]">Waiting for Nibbl: {pendingRequests.join(", ")}</p>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <section className="bg-white border border-[#EAEDFF] rounded-[20px] p-6 shadow-sm flex flex-col gap-3">
            <h2 className="font-jakarta font-bold text-base text-[#131B2E]">Receipt Matching</h2>
            <p className="text-xs text-[#64748B]">Add aliases here or save them during Redemptions manual review.</p>
            <div className="grid grid-cols-[1fr_1.4fr_1fr_auto] gap-2 text-[11px] font-bold text-[#454656]">
              <span>Retailer</span><span>Receipt Product Text</span><span>Item Code <span className="font-normal">(Optional)</span></span><span />
            </div>
            {aliases.map((row, i) => (
              <div key={row.id ?? `new-${i}`} className="grid grid-cols-[1fr_1.4fr_1fr_auto] gap-2 items-center">
                <input value={row.retailer} onChange={(e) => updateAlias(i, "retailer", e.target.value)} placeholder="Any" className={`${input} h-10`} />
                <input value={row.alias_text} onChange={(e) => updateAlias(i, "alias_text", e.target.value)} placeholder="ACME VAN GRAN 12OZ" className={`${input} h-10`} />
                <input value={row.item_code} onChange={(e) => updateAlias(i, "item_code", e.target.value)} placeholder="—" className={`${input} h-10`} />
                <button type="button" aria-label="Remove alias" onClick={() => setAliases((rows) => rows.filter((_, j) => j !== i))}
                  className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {aliases.length === 0 && <p className="text-xs text-[#94A3B8]">No aliases yet — aliases are optional.</p>}
            <button type="button" onClick={() => setAliases((rows) => [...rows, emptyAlias()])}
              className="h-10 rounded-xl bg-[#E2E7FF] text-[#001BD2] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
              <Plus className="w-4 h-4" /> Add Alias
            </button>
            <p className="text-[11px] text-[#94A3B8]">A retailer limits the alias to that store&apos;s receipts. The item code matches when it&apos;s printed on the receipt.</p>
          </section>

          {mode === "edit" && onDelete && (
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="self-end h-10 px-5 rounded-xl border border-red-300 text-red-600 text-sm font-bold flex items-center gap-2 cursor-pointer">
              <Trash2 className="w-4 h-4" /> Delete Product
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => void save()} disabled={saving}
          className="h-12 rounded-xl bg-[#001BD2] text-white font-bold text-sm disabled:opacity-60 cursor-pointer">
          {saving ? "Saving…" : mode === "edit" ? "Save Changes" : "Save Product"}
        </button>
        <button type="button" onClick={onCancel}
          className="h-12 rounded-xl bg-[#E2E7FF] text-[#001BD2] font-bold text-sm cursor-pointer">Cancel</button>
      </div>

      {confirmDelete && onDelete && (
        <DeleteProductModal productName={form.name} onClose={() => setConfirmDelete(false)} onConfirm={onDelete} />
      )}
    </div>
  );
}
