import type { StyleProps } from "../lib/project";
import { isComplexScript } from "../lib/captions/text";

/** Casing for Latin text. Malayalam/Devanagari/Tamil have no case, and transforms must never touch them. */
export function applyTransform(text: string, style: Pick<StyleProps, "textTransform" | "uppercase">): string {
  if (isComplexScript(text)) return text;
  const mode = style.textTransform ?? (style.uppercase ? "uppercase" : "none");
  if (mode === "uppercase") return text.toLocaleUpperCase();
  if (mode === "lowercase") return text.toLocaleLowerCase();
  if (mode === "capitalize") return text.replace(/(^|[\s\-"(])(\p{L})/gu, (_m, a, b) => a + b.toLocaleUpperCase());
  return text;
}
