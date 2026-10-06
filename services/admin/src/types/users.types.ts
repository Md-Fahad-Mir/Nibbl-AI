export interface UserDetail {
  id: string;
  sl: string;
  userName: string;
  email: string;
  phoneNumber: string;
  joiningDate: string;
  address?: string;
}

export interface UserFilterState {
  date: string;
  userName: string;
}
