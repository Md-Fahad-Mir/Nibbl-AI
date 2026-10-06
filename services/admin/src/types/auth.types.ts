export type AuthStep =
  | "sign-in"
  | "forgot-password"
  | "verify-email"
  | "reset-password";

export interface SignInFormData {
  username: string;
  password: string;
  rememberMe: boolean;
}

export interface ForgotPasswordFormData {
  email: string;
}

export interface VerifyEmailFormData {
  otp: string;
}

export interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}
