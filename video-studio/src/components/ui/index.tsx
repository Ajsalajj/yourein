"use client";
/** Small shadcn-style primitives (Radix + Tailwind + cva). */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/cn";

const button = cva("inline-flex items-center justify-center gap-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap", {
  variants: {
    variant: {
      primary: "bg-accent text-[#0b0c10] hover:bg-[#a094ff] font-semibold",
      secondary: "bg-panel-2 border border-line hover:bg-[#20242f] text-text",
      ghost: "hover:bg-panel-2 text-mute hover:text-text",
      danger: "bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30",
    },
    size: { sm: "h-7 px-2.5", md: "h-9 px-3.5", lg: "h-11 px-5 text-sm", icon: "h-8 w-8" },
  },
  defaultVariants: { variant: "secondary", size: "md" },
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...p }, ref) => <button ref={ref} type={type} className={cn(button({ variant, size }), className)} {...p} />);
Button.displayName = "Button";

export function Slider({ label, value, min, max, step = 1, onChange, format, id }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string; id?: string }) {
  const lid = id ?? `sl-${label.replace(/\W+/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px]">
        <label id={lid} className="text-mute">{label}</label>
        <span className="tabular-nums text-text">{format ? format(value) : value}</span>
      </div>
      <SliderPrimitive.Root aria-labelledby={lid} className="relative flex h-5 w-full touch-none select-none items-center" value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])}>
        <SliderPrimitive.Track className="relative h-1.5 grow rounded-full bg-line"><SliderPrimitive.Range className="absolute h-full rounded-full bg-accent" /></SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-accent bg-white shadow focus-visible:outline-2 focus-visible:outline-accent" />
      </SliderPrimitive.Root>
    </div>
  );
}

export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-[12px] text-mute">
      <span>{label}</span>
      <SwitchPrimitive.Root checked={checked} onCheckedChange={onChange} className="relative h-5 w-9 rounded-full bg-line data-[state=checked]:bg-accent transition-colors">
        <SwitchPrimitive.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-[18px]" />
      </SwitchPrimitive.Root>
    </label>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-[12px]">
      <span className="text-mute">{label}</span>
      {children}
    </label>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : value === "transparent" ? "#000000" : "#ffffff";
  return (
    <div className="space-y-1.5 text-[12px]">
      <span className="text-mute">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={label} value={hex} onChange={(e) => onChange(e.target.value)} />
        <input className="field !py-1 font-mono text-[11px]" aria-label={`${label} value`} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-4 space-y-3">
      <div className="flex items-center justify-between"><h3 className="text-[11px] font-semibold uppercase tracking-wider text-mute">{title}</h3>{right}</div>
      {children}
    </section>
  );
}

export function Tip({ text, children }: { text: string; children: React.ReactElement }) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal><TooltipPrimitive.Content sideOffset={6} className="z-50 rounded-md bg-[#252938] px-2 py-1 text-[11px] text-text shadow-lg">{text}</TooltipPrimitive.Content></TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export function Badge({ children, tone = "mute" }: { children: React.ReactNode; tone?: "mute" | "ok" | "warn" | "danger" | "accent" }) {
  const t = { mute: "bg-panel-2 text-mute", ok: "bg-ok/15 text-ok", warn: "bg-warn/15 text-warn", danger: "bg-danger/15 text-danger", accent: "bg-accent/15 text-accent" }[tone];
  return <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium", t)}>{children}</span>;
}

export function Status({ kind, children }: { kind: "not-implemented" | "partial"; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border p-3 text-[12px] leading-relaxed", kind === "not-implemented" ? "border-warn/30 bg-warn/10 text-warn" : "border-accent/30 bg-accent/10 text-accent")}>
      <div className="mb-1 font-semibold">{kind === "not-implemented" ? "Not implemented yet" : "Partly implemented"}</div>
      <div className="text-text/80">{children}</div>
    </div>
  );
}
