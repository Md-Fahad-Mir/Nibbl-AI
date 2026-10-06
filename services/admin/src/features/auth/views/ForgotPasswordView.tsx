"use client";

import React from "react";
import { AuthContainer } from "../components/AuthContainer";

export const ForgotPasswordView = () => {
  return <AuthContainer initialStep="forgot-password" />;
};
