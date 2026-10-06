export type WithdrawStatus = "Approved" | "Pending" | "Cancelled";

export interface WithdrawRequestDetail {
  id: string;
  sl: string;
  userName: string;
  providerName?: string;
  bankName: string;
  branchName?: string;
  accountType: string;
  accountNumber: string;
  routingNumber?: string;
  withdrawAmount: string;
  status: WithdrawStatus;
}
