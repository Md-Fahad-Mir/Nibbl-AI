"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useBrandApiStore } from "@/stores/useBrandApiStore";
import { formatInteger, formatMoney, toNumber } from "../../utils/backendMappers";

export default function AnalyticsProducts() {
  const [page, setPage] = useState(1);
  const products = useBrandApiStore((state) => state.analyticsProducts);
  const itemsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(products.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = products.slice(pageStart, pageStart + itemsPerPage);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="flex flex-col gap-8 w-full text-left font-manrope animate-slide-up">
      <div className="w-full bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden flex flex-col">
        <div className="bg-[#F2F3FF] px-8 py-5 border-b border-[#C5C5D9]/10">
          <h3 className="font-jakarta font-bold text-lg text-[#131B2E]">
            Product Performance
          </h3>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#C5C5D9]/10 bg-[#FAF8FF]">
                <th className="p-4 text-left text-[10px] font-bold tracking-wider text-[#454656] uppercase">Product</th>
                <th className="p-4 text-right text-[10px] font-bold tracking-wider text-[#454656] uppercase">Redemptions</th>
                <th className="p-4 text-right text-[10px] font-bold tracking-wider text-[#454656] uppercase">Reviews</th>
                <th className="p-4 text-right text-[10px] font-bold tracking-wider text-[#454656] uppercase">Avg Rating</th>
                <th className="p-4 text-right text-[10px] font-bold tracking-wider text-[#454656] uppercase">Reward Spend</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((product) => (
                <tr key={String(product.product_id)} className="border-b border-[#C5C5D9]/5 hover:bg-[#F2F3FF]/30 transition-colors text-sm text-[#454656]">
                  <td className="p-4 text-left font-bold text-[#131B2E]">{String(product.name ?? "Product")}</td>
                  <td className="p-4 text-right font-bold text-[#131B2E]">{formatInteger(product.redemptions)}</td>
                  <td className="p-4 text-right font-bold text-[#131B2E]">{formatInteger(product.reviews_count)}</td>
                  <td className="p-4 text-right font-bold text-[#131B2E]">
                    <span className="inline-flex items-center gap-1">
                      {toNumber(product.average_rating).toFixed(1)}
                      <Star className="w-3 h-3 fill-[#FBBF24] text-[#FBBF24]" />
                    </span>
                  </td>
                  <td className="p-4 text-right font-bold text-[#001BD2]">{formatMoney(product.reward_spend)}</td>
                </tr>
              ))}
              {paginatedProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-sm font-semibold text-slate-400">
                    No product analytics yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-8 py-5 border-t border-[#C5C5D9]/10 bg-[#FAF8FF] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-semibold text-[#454656]">
          <span>
            Showing {paginatedProducts.length ? pageStart + 1 : 0} -{" "}
            {Math.min(pageStart + paginatedProducts.length, products.length)} of{" "}
            {products.length} products
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              &lt;
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold ${
                  currentPage === pageNumber
                    ? "bg-[#001BD2] text-white border-[#001BD2]"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
