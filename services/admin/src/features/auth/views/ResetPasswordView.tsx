"use client";

import React from "react";
import { AuthContainer } from "../components/AuthContainer";

export const ResetPasswordView = () => {
  return <AuthContainer initialStep="reset-password" />;
};
