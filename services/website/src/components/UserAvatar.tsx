"use client";

import { useState } from "react";
import Image from "next/image";
import { UserRound } from "lucide-react";

interface UserAvatarProps {
  src?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
  iconClassName?: string;
  sizes?: string;
  priority?: boolean;
}

export default function UserAvatar({
  src,
  alt = "User profile",
  className = "h-10 w-10",
  imageClassName = "object-cover",
  iconClassName = "h-5 w-5",
  sizes = "40px",
  priority = false,
}: UserAvatarProps) {
  const [failedSrc, setFailedSrc] = useState("");
  const imageSrc = typeof src === "string" && src.trim() ? src : "";
  const hasImageError = failedSrc === imageSrc;

  return (
    <span className={`${className} relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F5F5FF] text-[#3E3EDF]`}>
      {imageSrc && !hasImageError ? (
        <Image
          src={imageSrc}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={`${imageClassName} h-full w-full`}
          onError={() => setFailedSrc(imageSrc)}
          unoptimized
        />
      ) : (
        <UserRound className={iconClassName} aria-hidden="true" />
      )}
    </span>
  );
}
