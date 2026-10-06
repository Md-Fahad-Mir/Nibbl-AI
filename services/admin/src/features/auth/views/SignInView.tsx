"use client";

import React from "react";
import { AuthContainer } from "../components/AuthContainer";

export const SignInView = () => {
  return <AuthContainer initialStep="sign-in" />;
};
