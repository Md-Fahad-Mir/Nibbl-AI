export type SettingsSubTab =
  | "menu"
  | "personal-info"
  | "change-password"
  | "faq"
  | "privacy-policy"
  | "terms-conditions";

export interface UserProfileData {
  name: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  role: string;
  avatarUrl?: string;
}
