"use client";

import React from "react";
import { AuthContainer } from "../components/AuthContainer";

export const VerifyEmailView = () => {
  return <AuthContainer initialStep="verify-email" />;
};
