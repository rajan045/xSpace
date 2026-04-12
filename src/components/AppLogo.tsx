import React from "react";

/** Same asset as the marketing site (`public/logo.png`). */
export function AppLogo({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      className={`object-contain ${className}`.trim()}
      draggable={false}
    />
  );
}
