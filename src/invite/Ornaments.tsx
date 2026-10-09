import React from "react";
import type { Theme } from "@/data/templates";

const MOTIFS: Record<Theme["motif"], React.ReactNode> = {
  sprig: <path d="M24 30C24 20 24 12 24 4M24 24C17 22 12 17 11 10C17 11 22 15 24 21M24 24C31 22 36 17 37 10C31 11 26 15 24 21M24 13C20 11 18 7 18 3C22 4 24 7 24 10M24 13C28 11 30 7 30 3C26 4 24 7 24 10" />,
  leaf: <path d="M24 31V6M24 26C16 25 11 20 9 12C17 12 22 17 24 23M24 26C32 25 37 20 39 12C31 12 26 17 24 23M24 14C20 12 18 8 19 3C23 5 25 9 24 12M24 14C28 12 30 8 29 3C25 5 23 9 24 12" />,
  rose: <path d="M24 17a3 3 0 1 1 5 2a6 6 0 1 1-10-5a9 9 0 1 1 14 9a11 11 0 0 1-18 0M24 29V34M24 31C20 31 17 33 15 36M24 31C28 31 31 33 33 36" />,
  jasmine: <path d="M24 18C21 14 21 8 24 4C27 8 27 14 24 18ZM24 18C19 18 14 15 12 11C17 10 22 13 24 18ZM24 18C29 18 34 15 36 11C31 10 26 13 24 18ZM24 18C20 21 18 27 20 32C24 29 25 23 24 18ZM24 18C28 21 30 27 28 32C24 29 23 23 24 18Z" />,
  blossom: <path d="M24 18C20 15 20 8 24 5C28 8 28 15 24 18ZM24 18C19 19 13 16 12 11C17 9 23 13 24 18ZM24 18C29 19 35 16 36 11C31 9 25 13 24 18ZM24 18C22 23 16 26 12 24C13 19 19 16 24 18ZM24 18C26 23 32 26 36 24C35 19 29 16 24 18ZM24 18V32" />,
  star: <path d="M24 3L27.4 14.6L39 18L27.4 21.4L24 33L20.6 21.4L9 18L20.6 14.6ZM24 11L26 16L31 18L26 20L24 25L22 20L17 18L22 16Z" />,
  lotus: <path d="M24 30C19 25 19 13 24 6C29 13 29 25 24 30ZM24 30C16 29 11 22 11 14C17 16 22 22 24 30ZM24 30C32 29 37 22 37 14C31 16 26 22 24 30ZM24 30C15 32 7 28 4 22C11 21 19 24 24 30ZM24 30C33 32 41 28 44 22C37 21 29 24 24 30Z" />,
  marigold: <path d="M24 8a10 10 0 1 0 .01 0ZM24 13a5 5 0 1 0 .01 0ZM24 4v4M24 28v4M10 18h4M34 18h4M14 8l3 3M31 25l3 3M34 8l-3 3M17 25l-3 3" />,
  orchid: <path d="M24 18C20 14 20 7 24 3C28 7 28 14 24 18ZM24 18C17 20 10 16 9 9C16 8 22 12 24 18ZM24 18C31 20 38 16 39 9C32 8 26 12 24 18ZM24 18C20 22 19 28 22 33C25 29 26 23 24 18ZM24 18C28 22 29 28 26 33" />,
  lamp: <path d="M24 3C21 7 21 10 24 12C27 10 27 7 24 3ZM15 14H33L30 18H18ZM24 18V28M19 22H29M16 32H32L29 28H19Z" />,
  palm: <path d="M24 34V14M24 14C20 8 14 6 8 8C13 9 18 12 24 14ZM24 14C28 8 34 6 40 8C35 9 30 12 24 14ZM24 14C19 12 12 14 8 19C14 17 19 16 24 14ZM24 14C29 12 36 14 40 19C34 17 29 16 24 14ZM24 14C23 9 24 5 27 2C27 7 26 11 24 14Z" />,
};

/** The small drawn ornament that belongs to a design (sprig, lotus, star...). */
export function Motif({ motif, className, size = 48 }: { motif: Theme["motif"]; className?: string; size?: number }) {
  return (
    <svg className={`motif${className ? ` ${className}` : ""}`} viewBox="0 0 48 38" width={size} height={(size * 38) / 48} fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {MOTIFS[motif]}
    </svg>
  );
}

/** Section divider: two foil lines that draw outward from the ornament. */
export function Divider({ motif, className }: { motif: Theme["motif"]; className?: string }) {
  return (
    <div className={`divider${className ? ` ${className}` : ""}`} aria-hidden="true">
      <span className="divider-line" data-draw="left" />
      <Motif motif={motif} size={40} />
      <span className="divider-line" data-draw="right" />
    </div>
  );
}
