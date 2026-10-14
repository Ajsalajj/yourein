import type { Metadata } from "next";
import { Catalog } from "@/components/site/Catalog";

/** The same catalog as the home page, reached from buttons: kept out of search so it does not compete with the real landing pages. */
export const metadata: Metadata = { title: "Create an invitation", description: "Choose a design to start your invitation. Customize it for free and pay only when you publish.", robots: { index: false, follow: true } };

export default function CreatePage() {
  return <Catalog heading="Choose a design to start" intro="Preview any design, then tap Customize. You can switch designs later without losing what you have written." />;
}
