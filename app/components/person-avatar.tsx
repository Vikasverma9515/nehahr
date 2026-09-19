/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import { avatarFor, type Gender } from "@/app/lib/avatars";

/**
 * A round face for any person, chosen automatically from their name (and gender, when known).
 * `badge` puts a small status marker on the bottom-right corner.
 */
export function PersonAvatar({
  name,
  gender,
  size = 32,
  className = "",
  ring = "ring-dark-bg",
  shape = "full",
  badge,
}: {
  name?: string | null;
  gender?: Gender;
  size?: number;
  className?: string;
  ring?: string;
  shape?: "full" | "soft";
  badge?: ReactNode;
}) {
  const radius = shape === "soft" ? "rounded-xl" : "rounded-full";
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={{ width: size, height: size }}>
      <img
        src={avatarFor(name, gender)}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        draggable={false}
        className={`h-full w-full select-none bg-white/10 object-cover ring-2 ${ring} ${radius}`}
      />
      {badge ? <span className="absolute -bottom-1 -right-1 flex items-center justify-center">{badge}</span> : null}
    </span>
  );
}
