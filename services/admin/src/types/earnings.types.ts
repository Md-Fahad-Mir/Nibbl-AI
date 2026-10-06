export interface TransactionDetail {
  id: string;
  transactionId: string;
  userName: string;
  brandName: string;
  amount: string;
  date: string;
  accountNumber?: string;
  accountHolderName?: string;
  providerName?: string;
}

export interface EarningsFilterState {
  date: string;
  userName: string;
  brandName: string;
}
