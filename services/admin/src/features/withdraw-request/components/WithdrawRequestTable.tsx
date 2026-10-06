"use client";

import React from "react";
import { WithdrawRequestDetail } from "@/types/withdraw-request.types";
import { PaginationBar } from "@/features/earnings/components/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";

interface WithdrawRequestTableProps {
  requests?: WithdrawRequestDetail[];
  onViewRequest?: (request: WithdrawRequestDetail) => void;
}

export const WithdrawRequestTable: React.FC<WithdrawRequestTableProps> = ({
  requests = [],
  onViewRequest,
}) => {
  const {
    currentPage,
    totalPages,
    paginatedItems,
    setPage,
  } = useClientPagination(requests, 10);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "text-[#2E7D32]";
      case "Pending":
        return "text-[#E27C11]";
      case "Cancelled":
        return "text-[#CD390F]";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="w-full bg-[#FEFEFE] rounded-[8px] shadow-[0px_2px_8px_rgba(0,0,0,0.1)] p-4 sm:p-6 flex flex-col gap-6 overflow-hidden">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between">
        <h2 className="font-inter text-[20px] font-medium leading-[24px] text-[#1F1D1D]">
          Withdraw Request List
        </h2>
      </div>

      {/* Table Container */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[750px]">
          {/* Table Header */}
          <thead>
            <tr className="bg-[#3E3EDF] text-[#FEFEFE] font-inter text-[16px] font-normal leading-[19px] h-[50px]">
              <th className="px-6 py-3 rounded-l-[4px]">#Sl</th>
              <th className="px-6 py-3">User Name</th>
              <th className="px-6 py-3">Bank Name</th>
              <th className="px-6 py-3">A/C Type</th>
              <th className="px-6 py-3">A/C Number</th>
              <th className="px-6 py-3">Withdraw Amount</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right rounded-r-[4px]">Action</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="font-inter text-[14px] text-[#575757]">
            {paginatedItems.length ? paginatedItems.map((req) => (
              <tr
                key={req.id}
                className="h-[52px] border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-3">{req.sl}</td>
                <td className="px-6 py-3">{req.userName}</td>
                <td className="px-6 py-3">{req.bankName}</td>
                <td className="px-6 py-3">{req.accountType}</td>
                <td className="px-6 py-3">{req.accountNumber}</td>
                <td className="px-6 py-3">{req.withdrawAmount}</td>
                <td
                  className={`px-6 py-3 font-medium ${getStatusColor(
                    req.status
                  )}`}
                >
                  {req.status}
                </td>
                <td className="px-6 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onViewRequest && onViewRequest(req)}
                    className="inline-flex items-center justify-center w-8 h-8 text-[#3E3EDF] hover:bg-[#3E3EDF]/10 rounded-full transition-colors cursor-pointer"
                    aria-label={`View withdraw details for ${req.userName}`}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#3E3EDF"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </td>
              </tr>
            )) : (
              <tr className="h-[72px] border-b border-gray-100">
                <td colSpan={8} className="px-6 py-5 text-center text-[#777777]">
                  No withdrawal requests returned from the backend.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <PaginationBar
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
};
