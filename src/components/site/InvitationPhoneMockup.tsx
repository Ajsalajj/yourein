import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import type { Template } from "@/data/templates";

type Props = {
  /** The design whose curated first screen is shown. Omit when passing `children`. */
  t?: Template;
  /** "hero" shows the design's catalog image; "alt" shows its other state (sealed or opened). */
  variant?: "hero" | "alt";
  /** Rotation in degrees. */
  tilt?: number;
  shadow?: "soft" | "deep" | "none";
  /** Any CSS width. Defaults to filling its container. */
  size?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  /** Custom screen content instead of a design image. */
  children?: ReactNode;
};

/**
 * A slim, modern phone: hairline bezel, edge-to-edge screen, a quiet sensor
 * pill and a soft shadow. Everything scales with its width.
 */
export function InvitationPhoneMockup({ t, variant = "hero", tilt, shadow = "soft", size, priority, sizes = "(max-width: 720px) 40vw, 260px", className, children }: Props) {
  const style = { ...(size ? { "--pm-w": size } : null), ...(tilt ? { "--pm-tilt": `${tilt}deg` } : null) } as CSSProperties;
  return (
    <span className={`pm${className ? ` ${className}` : ""}`} data-shadow={shadow} style={style}>
      <span className="pm-screen">
        {children ??
          (t && (
            <Image
              src={`/thumbs/${t.slug}${variant === "alt" ? "-alt" : ""}.webp`}
              alt={variant === "alt" ? "" : `${t.name} invitation shown on a phone`}
              width={780}
              height={1688}
              sizes={sizes}
              priority={priority}
            />
          ))}
      </span>
      <span className="pm-island" aria-hidden="true" />
    </span>
  );
}
