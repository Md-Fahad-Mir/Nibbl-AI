export type AuthStage =
  | "splash"
  | "onboarding"
  | "signin"
  | "signup"
  | "forgot-password"
  | "verify-email"
  | "reset-password"
  | "home"
  | "claim-details"
  | "view-details"
  | "profile"
  | "my-reward"
  | "wallet";

export interface SignInCredentials {
  email: string;
  password?: string;
  rememberMe?: boolean;
}

export interface SignUpCredentials {
  fullName: string;
  email: string;
  password?: string;
}
