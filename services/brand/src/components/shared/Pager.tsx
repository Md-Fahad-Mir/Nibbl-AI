"use client";

import { useState } from "react";

export type PageState = { page: number; pages: number; total: number; size: number; setPage: (page: number) => void };

/** Client-side paging for lists the API returns whole. Changing ``resetKey``
 *  (a tab or filter) goes back to page 1. */
export const usePaged = <T,>(rows: T[], size = 10, resetKey = "") => {
  const [state, setState] = useState({ key: resetKey, page: 1 });
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(state.key === resetKey ? state.page : 1, pages);
  const setPage = (next: number) => setState({ key: resetKey, page: next });
  return { items: rows.slice((page - 1) * size, page * size), page, pages, total: rows.length, size, setPage };
};

/** "Showing 1 to 10 of 86 reviews" + page buttons (window of 5), in the
 *  Customers table style. Hidden when the list is empty. */
export default function Pager({ paged, noun, className = "" }: { paged: PageState; noun: string; className?: string }) {
  const { page, pages, total, size, setPage } = paged;
  if (!total) return null;
  const first = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => first + i);
  const base = "w-8 h-8 rounded-full cursor-pointer flex items-center justify-center font-bold text-xs disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className={`flex flex-wrap justify-between items-center gap-4 font-manrope ${className}`}>
      <span className="text-xs font-semibold text-[#454656]">
        Showing {(page - 1) * size + 1} to {Math.min(page * size, total)} of {total.toLocaleString()} {noun}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-1.5">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}
            className={`${base} bg-white hover:bg-slate-100 border border-slate-200 text-slate-700`}>&lt;</button>
          {numbers.map((n) => (
            <button key={n} onClick={() => setPage(n)}
              className={`${base} ${n === page ? "bg-[#001BD2] text-white shadow-sm border-none" : "bg-white hover:bg-slate-100 border border-slate-200 text-slate-700"}`}>
              {n}
            </button>
          ))}
          <button disabled={page === pages} onClick={() => setPage(page + 1)}
            className={`${base} bg-white hover:bg-slate-100 border border-slate-200 text-slate-700`}>&gt;</button>
        </div>
      )}
    </div>
  );
}
